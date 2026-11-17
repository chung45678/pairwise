"""Explanations: why two people matched, plus an icebreaker.

Reasons are built from evidence: the literal terms that overlap between two
profiles. They're stored in a neutral structured form and rendered per viewer
("You're looking for X" vs "Maya is looking for X") at read time.
"""

from __future__ import annotations

import hashlib
import logging
import re
from collections.abc import Sequence
from concurrent.futures import ThreadPoolExecutor
from typing import Protocol

import httpx
import numpy as np

from pairwise.matching.profile import Profile, normalize_tag

log = logging.getLogger(__name__)

MIN_TERM_WEIGHT = 0.02
MAX_TERMS = 3


def top_overlap_terms(
    u: np.ndarray, v: np.ndarray, vocab: np.ndarray, max_terms: int = MAX_TERMS
) -> list[str]:
    """Terms that carry the similarity between two TF-IDF vectors.

    The dot product u·v is a sum of per-term products, so the biggest products are
    the terms responsible for the match. Unigrams already covered by a chosen
    bigram are dropped ("design feedback" beats "design" + "feedback").
    """
    if vocab.size == 0 or u.shape[0] != vocab.size:
        return []
    contrib = u * v
    order = np.argsort(-contrib)
    chosen: list[str] = []
    for idx in order:
        if contrib[idx] < MIN_TERM_WEIGHT or len(chosen) >= max_terms:
            break
        term = str(vocab[idx])
        if any(term in c.split() or term == c for c in chosen):
            continue
        if " " in term:  # a bigram replaces unigrams it contains
            chosen = [c for c in chosen if c not in term.split()]
        chosen.append(term)
    return chosen[:max_terms]


_WORD = re.compile(r"[\w+#][\w+#\-]*")


def merge_adjacent(terms: list[str], text: str, max_gap: int = 1, max_words: int = 6) -> list[str]:
    """Join terms that sit next to each other in what the person wrote.

    "critique", "ux" and "design" all hit inside "critique my UX design", which
    reads far better as one phrase than as three fragments.
    """
    tokens = [(m.group().lower(), m.start(), m.end()) for m in _WORD.finditer(text)]
    words = [t[0] for t in tokens]
    hits: list[tuple[int, int, str]] = []
    for term in terms:
        tw = term.split()
        for i in range(len(words) - len(tw) + 1):
            if words[i : i + len(tw)] == tw:
                hits.append((i, i + len(tw) - 1, term))
                break
    hits.sort()
    groups: list[list[tuple[int, int, str]]] = []
    for h in hits:
        if groups and h[0] - groups[-1][-1][1] - 1 <= max_gap:
            groups[-1].append(h)
        else:
            groups.append([h])
    merged, used = [], set()
    for g in groups:
        span = g[-1][1] - g[0][0] + 1
        if len(g) >= 2 and span <= max_words:
            merged.append(text[tokens[g[0][0]][1] : tokens[g[-1][1]][2]].lower())
            used.update(h[2] for h in g)
    return merged + [t for t in terms if t not in used]


def build_reasons(features, i: int, j: int, vocab: np.ndarray | None) -> list[dict]:
    """Structured reasons for pair (i, j). Uses ids, not indices, so they survive storage."""
    a, b = features.profiles[i], features.profiles[j]
    reasons: list[dict] = []
    vocab = vocab if vocab is not None else np.array([], dtype=object)

    for seeker, helper, si, hi in ((a, b, i, j), (b, a, j, i)):
        if features.help[si, hi] <= 0.05:
            continue
        raw = top_overlap_terms(features.looking[si], features.helping[hi], vocab)
        terms = merge_adjacent(raw, seeker.looking_for)
        if terms:
            reasons.append(
                {
                    "type": "complement",
                    "seeker": seeker.id,
                    "helper": helper.id,
                    "terms": terms,  # display phrases, as the seeker wrote them
                    "topic": raw[0],  # the single strongest term, for icebreakers
                    "strength": round(float(features.help[si, hi]), 3),
                }
            )

    shared_tags = sorted(
        {normalize_tag(t) for t in a.interests} & {normalize_tag(t) for t in b.interests}
    )
    if not shared_tags and features.shared[i, j] > 0.05:
        shared_tags = top_overlap_terms(features.interest_vecs[i], features.interest_vecs[j], vocab)
    if shared_tags:
        reasons.append({"type": "shared", "terms": shared_tags[:MAX_TERMS]})

    if features.diversity[i, j] > 0:
        reasons.append({"type": "roles", "roles": {str(a.id): a.role, str(b.id): b.role}})

    reasons.sort(key=lambda r: {"complement": 0, "shared": 1, "roles": 2}[r["type"]])
    return reasons[:3]


def _join(terms: Sequence[str]) -> str:
    terms = list(terms)
    if len(terms) <= 1:
        return "".join(terms)
    return ", ".join(terms[:-1]) + " and " + terms[-1]


def render_reason(reason: dict, names: dict[int, str], viewer: int | None = None) -> str:
    """Human text for a stored reason. `viewer` switches to second person."""

    def who(pid: int) -> str:
        return "You" if pid == viewer else names.get(pid, "They")

    t = reason["type"]
    if t == "complement":
        seeker, helper = reason["seeker"], reason["helper"]
        lead = "You're" if seeker == viewer else f"{who(seeker)} is"
        return f"{lead} looking for {_join(reason['terms'])}. {who(helper)} can help with that."
    if t == "shared":
        lead = "You're both" if viewer is not None else "Both"
        return f"{lead} into {_join(reason['terms'])}."
    if t == "roles":
        roles = list(reason["roles"].values())
        return f"Different angles: {roles[0]} meets {roles[1]}."
    return ""


# ── Icebreakers ──────────────────────────────────────────────────────────────


class IcebreakerWriter(Protocol):
    def write(self, a: Profile, b: Profile, reasons: list[dict]) -> str: ...


_TEMPLATES = {
    "complement": [
        "One of you is looking for {term}, the other has done it. "
        'Ask: "What actually helped you most with {term}?"',
        'Ask: "What\'s the hardest part of {term} for you right now?" Then trade notes.',
        'Ask: "What would you tell someone just starting out with {term}?"',
    ],
    "shared": [
        'You\'re both into {term}. Ask: "What are you working on in {term} right now?"',
        'Start with: "What got you interested in {term}?"',
        "You both listed {term}. Ask: \"What's your take on {term} that most people "
        'would disagree with?"',
    ],
    "roles": [
        'A {r1} and a {r2}. Ask: "What do {r2}s get wrong about working with {r1}s?"',
        'Swap notes: "What does a normal week look like in your role?"',
    ],
    "none": [
        'Ask: "What are you building or working on this term?"',
        'Start with: "What brought you to this event?"',
    ],
}


def _pick(options: list[str], seed: str) -> str:
    h = int(hashlib.sha256(seed.encode()).hexdigest(), 16)
    return options[h % len(options)]


class TemplateWriter:
    """Deterministic, free, and always available."""

    def write(self, a: Profile, b: Profile, reasons: list[dict]) -> str:
        seed = f"{min(a.id, b.id)}-{max(a.id, b.id)}"
        top = reasons[0] if reasons else {"type": "none"}
        t = top["type"]
        if t in ("complement", "shared"):
            return _pick(_TEMPLATES[t], seed).format(term=top.get("topic") or top["terms"][0])
        if t == "roles":
            r1, r2 = (top["roles"][str(a.id)], top["roles"][str(b.id)])
            return _pick(_TEMPLATES["roles"], seed).format(r1=r1.lower(), r2=r2.lower())
        return _pick(_TEMPLATES["none"], seed)


class ClaudeWriter:
    """LLM icebreakers via the Anthropic Messages API, falling back to templates.

    Sends first names, roles, interests and computed reasons only: no emails or
    full names. Any failure (network, rate limit, bad output) falls back silently,
    so an API problem never blocks an event.
    """

    API_URL = "https://api.anthropic.com/v1/messages"

    def __init__(
        self,
        api_key: str,
        model: str,
        client: httpx.Client | None = None,
        fallback: IcebreakerWriter | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=10)
        self.fallback = fallback or TemplateWriter()

    def _prompt(self, a: Profile, b: Profile, reasons: list[dict]) -> str:
        names = {a.id: a.first_name, b.id: b.first_name}
        why = " ".join(render_reason(r, names) for r in reasons) or "No strong overlap."

        def card(p: Profile) -> str:
            return (
                f"{p.first_name} ({p.role or 'student'}). Interests: "
                f"{p.interests_text or 'n/a'}. Looking for: {p.looking_for or 'n/a'}. "
                f"Can help with: {p.can_help_with or 'n/a'}."
            )

        return (
            "Two students were matched at a university club networking event.\n"
            f"- {card(a)}\n- {card(b)}\nWhy they matched: {why}\n\n"
            "Write ONE icebreaker either person could say to open the conversation. "
            "Under 30 words, specific to them, casual, no emojis, no em dashes. "
            "Output only the icebreaker."
        )

    def write(self, a: Profile, b: Profile, reasons: list[dict]) -> str:
        try:
            resp = self.client.post(
                self.API_URL,
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": 120,
                    "messages": [{"role": "user", "content": self._prompt(a, b, reasons)}],
                },
            )
            resp.raise_for_status()
            text = (
                "".join(
                    blk.get("text", "")
                    for blk in resp.json().get("content", [])
                    if blk.get("type") == "text"
                )
                .strip()
                .strip('"')
            )
            if not text or len(text) > 300:
                raise ValueError("unusable icebreaker")
            return text
        except Exception as exc:  # noqa: BLE001  (fallback is the whole point)
            log.warning("icebreaker LLM failed, using template: %s", exc)
            return self.fallback.write(a, b, reasons)


def write_all(
    writer: IcebreakerWriter, jobs: list[tuple[Profile, Profile, list[dict]]], workers: int = 8
) -> list[str]:
    """Run icebreakers in parallel. Templates are instant, so this only matters for LLMs."""
    if isinstance(writer, TemplateWriter) or len(jobs) <= 1:
        return [writer.write(*job) for job in jobs]
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(lambda job: writer.write(*job), jobs))
