"""End-to-end matching: profiles in, explained matches out. No database here."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np

from pairwise.config import Settings
from pairwise.matching.encoders import EmbeddingsEncoder, TextEncoder, TfidfEncoder
from pairwise.matching.explain import (
    ClaudeWriter,
    IcebreakerWriter,
    TemplateWriter,
    build_reasons,
    write_all,
)
from pairwise.matching.profile import Profile
from pairwise.matching.scoring import ScoringWeights, build_features, score_matrix
from pairwise.matching.solver import solve_rounds


@dataclass(frozen=True)
class MatchResult:
    a_id: int
    b_id: int
    score: float
    round: int
    reasons: list[dict]
    icebreaker: str


@dataclass(frozen=True)
class MatchStats:
    attendees: int
    matches: int
    coverage: float
    mean_score: float
    min_best_score: float  # the worst-off person's best match: our fairness signal


def encoder_from_settings(s: Settings) -> TextEncoder:
    if s.embeddings_url:
        return EmbeddingsEncoder(s.embeddings_url, s.embeddings_api_key, s.embeddings_model)
    return TfidfEncoder()


def writer_from_settings(s: Settings) -> IcebreakerWriter:
    if s.anthropic_api_key:
        return ClaudeWriter(s.anthropic_api_key, s.anthropic_model)
    return TemplateWriter()


def run_matching(
    profiles: Sequence[Profile],
    k: int,
    encoder: TextEncoder | None = None,
    weights: ScoringWeights | None = None,
    writer: IcebreakerWriter | None = None,
) -> tuple[list[MatchResult], MatchStats]:
    profiles = list(profiles)
    writer = writer or TemplateWriter()

    # Scoring may use embeddings; explanations always use TF-IDF so they can cite words.
    encoder = encoder or TfidfEncoder()
    features = build_features(profiles, encoder)
    scores = score_matrix(features, weights)
    pairs = solve_rounds(scores, k)

    if isinstance(encoder, TfidfEncoder):
        explain_features, explain_enc = features, encoder
    else:
        explain_enc = TfidfEncoder()
        explain_features = build_features(profiles, explain_enc)
    vocab = explain_enc.feature_names

    jobs, reasons_list = [], []
    for p in pairs:
        reasons = build_reasons(explain_features, p.i, p.j, vocab)
        reasons_list.append(reasons)
        jobs.append((profiles[p.i], profiles[p.j], reasons))
    icebreakers = write_all(writer, jobs)

    results = [
        MatchResult(profiles[p.i].id, profiles[p.j].id, round(p.score, 4), p.round, r, ice)
        for p, r, ice in zip(pairs, reasons_list, icebreakers, strict=True)
    ]
    return results, _stats(len(profiles), pairs)


def _stats(n: int, pairs) -> MatchStats:
    if not pairs:
        return MatchStats(n, 0, 0.0, 0.0, 0.0)
    best = np.full(n, -np.inf)
    for p in pairs:
        best[p.i] = max(best[p.i], p.score)
        best[p.j] = max(best[p.j], p.score)
    covered = np.isfinite(best)
    return MatchStats(
        attendees=n,
        matches=len(pairs),
        coverage=round(float(covered.mean()), 4),
        mean_score=round(float(np.mean([p.score for p in pairs])), 4),
        min_best_score=round(float(best[covered].min()), 4),
    )
