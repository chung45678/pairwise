"""Organizer dashboard metrics. See docs/DESIGN.md §6."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import asdict, dataclass

from pairwise.models import Attendee, Feedback, Match, Outcome


@dataclass
class RoundStats:
    round: int
    matches: int
    with_feedback: int
    talked: int
    conversation_rate: float | None


@dataclass
class EventMetrics:
    registered: int
    intake_complete: int
    matched: int
    gave_feedback: int
    matches: int
    matches_with_feedback: int
    conversation_rate: float | None  # among matches with feedback
    conversation_rate_all: float | None  # among all matches (lower bound)
    avg_rating: float | None
    coverage: float | None
    outcomes: dict[str, int]
    by_round: list[RoundStats]

    def to_dict(self) -> dict:
        return asdict(self)


def _rate(num: int, den: int) -> float | None:
    return round(num / den, 4) if den else None


def compute_metrics(
    attendees: list[Attendee], matches: list[Match], feedback: list[Feedback]
) -> EventMetrics:
    complete = {a.id for a in attendees if a.intake_complete}
    matched_ids = {m.a_id for m in matches} | {m.b_id for m in matches}

    fb_by_match: dict[int, list[Feedback]] = defaultdict(list)
    for f in feedback:
        fb_by_match[f.match_id].append(f)

    talked_matches = {
        mid for mid, fs in fb_by_match.items() if any(f.outcome == Outcome.talked for f in fs)
    }
    ratings = [f.rating for f in feedback if f.outcome == Outcome.talked and f.rating]

    outcomes = {o.value: 0 for o in Outcome}
    for f in feedback:
        outcomes[f.outcome.value] += 1

    rounds: dict[int, list[Match]] = defaultdict(list)
    for m in matches:
        rounds[m.round].append(m)
    by_round = []
    for r in sorted(rounds):
        ms = rounds[r]
        with_fb = [m for m in ms if m.id in fb_by_match]
        talked = [m for m in ms if m.id in talked_matches]
        by_round.append(
            RoundStats(r, len(ms), len(with_fb), len(talked), _rate(len(talked), len(with_fb)))
        )

    return EventMetrics(
        registered=len(attendees),
        intake_complete=len(complete),
        matched=len(matched_ids),
        gave_feedback=len({f.attendee_id for f in feedback}),
        matches=len(matches),
        matches_with_feedback=len(fb_by_match),
        conversation_rate=_rate(len(talked_matches), len(fb_by_match)),
        conversation_rate_all=_rate(len(talked_matches), len(matches)),
        avg_rating=round(sum(ratings) / len(ratings), 2) if ratings else None,
        coverage=_rate(len(complete & matched_ids), len(complete)),
        outcomes=outcomes,
        by_round=by_round,
    )
