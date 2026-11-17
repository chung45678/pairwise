"""DB rows to API models. Keeps routes thin and the PII rules in one place."""

from __future__ import annotations

from pairwise.matching.explain import render_reason
from pairwise.models import Attendee, Event, Feedback, Match
from pairwise.schemas import (
    AttendeeAdmin,
    EventPublic,
    MatchOut,
    MyFeedback,
    MyMatch,
    PersonCard,
    ReasonOut,
)


def event_public(e: Event) -> EventPublic:
    return EventPublic(
        slug=e.slug,
        name=e.name,
        description=e.description,
        starts_at=e.starts_at,
        location=e.location,
        matches_per_person=e.matches_per_person,
        status=e.status,
    )


def attendee_admin(a: Attendee) -> AttendeeAdmin:
    return AttendeeAdmin(**a.model_dump(include=set(AttendeeAdmin.model_fields)))


def person_card(a: Attendee) -> PersonCard:
    # Deliberately no email: this is what other attendees see.
    return PersonCard(
        id=a.id, name=a.name, role=a.role, affiliation=a.affiliation, interests=a.interests or []
    )


def reason_out(r: dict, names: dict[int, str], viewer: int | None = None) -> ReasonOut:
    return ReasonOut(type=r["type"], text=render_reason(r, names, viewer), terms=r.get("terms", []))


def pair_names(a: Attendee, b: Attendee) -> dict[int, str]:
    """First names for a pair's reasons, or full names when both share a first name."""

    def first(p: Attendee) -> str:
        return p.name.split()[0] if p.name.strip() else "Someone"

    if first(a).lower() == first(b).lower():
        return {a.id: a.name, b.id: b.name}
    return {a.id: first(a), b.id: first(b)}


def match_out(m: Match, people: dict[int, Attendee], feedback: list[Feedback]) -> MatchOut:
    names = pair_names(people[m.a_id], people[m.b_id])
    return MatchOut(
        id=m.id,
        round=m.round,
        score=m.score,
        a=person_card(people[m.a_id]),
        b=person_card(people[m.b_id]),
        reasons=[reason_out(r, names) for r in m.reasons],
        icebreaker=m.icebreaker,
        feedback=[
            {"attendee_id": f.attendee_id, "outcome": f.outcome, "rating": f.rating}
            for f in feedback
        ],
    )


def my_match(m: Match, me: Attendee, people: dict[int, Attendee], mine: Feedback | None) -> MyMatch:
    other = people[m.b_id] if m.a_id == me.id else people[m.a_id]
    names = pair_names(me, other)
    return MyMatch(
        match_id=m.id,
        round=m.round,
        person=person_card(other),
        looking_for=other.looking_for,
        can_help_with=other.can_help_with,
        reasons=[reason_out(r, names, me.id) for r in m.reasons],
        icebreaker=m.icebreaker,
        my_feedback=MyFeedback(outcome=mine.outcome, rating=mine.rating) if mine else None,
    )
