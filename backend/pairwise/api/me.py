"""Attendee routes, authorized by the private token in their link."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, col, or_, select

from pairwise.api.deps import get_attendee_by_token, get_session
from pairwise.api.serializers import event_public, my_match
from pairwise.models import Attendee, Event, EventStatus, Feedback, Match
from pairwise.schemas import FeedbackIn, MeOut, MyFeedback

router = APIRouter(prefix="/api/me/{token}", tags=["attendee"])


def _my_matches(session: Session, me: Attendee) -> list[Match]:
    return list(
        session.exec(
            select(Match)
            .where(Match.event_id == me.event_id, or_(Match.a_id == me.id, Match.b_id == me.id))
            .order_by(Match.round, col(Match.score).desc())
        ).all()
    )


@router.get("", response_model=MeOut)
def read_me(me: Attendee = Depends(get_attendee_by_token), session: Session = Depends(get_session)):
    event = session.get(Event, me.event_id)
    published = event.status == EventStatus.published
    matches_out = []
    if published:  # drafts stay private until the organizer has reviewed them
        matches = _my_matches(session, me)
        other_ids = {m.a_id for m in matches} | {m.b_id for m in matches} | {me.id}
        people = {
            a.id: a for a in session.exec(select(Attendee).where(col(Attendee.id).in_(other_ids)))
        }
        mine = {
            f.match_id: f
            for f in session.exec(select(Feedback).where(Feedback.attendee_id == me.id))
        }
        matches_out = [my_match(m, me, people, mine.get(m.id)) for m in matches]
    return MeOut(
        event=event_public(event),
        name=me.name,
        intake_complete=me.intake_complete,
        published=published,
        matches=matches_out,
    )


@router.post("/feedback", response_model=MyFeedback)
def give_feedback(
    body: FeedbackIn,
    me: Attendee = Depends(get_attendee_by_token),
    session: Session = Depends(get_session),
):
    match = session.get(Match, body.match_id)
    if not match or me.id not in (match.a_id, match.b_id):
        raise HTTPException(404, "Match not found")
    event = session.get(Event, me.event_id)
    if event.status != EventStatus.published:
        raise HTTPException(409, "Matches aren't published yet")

    # Upsert: changing your answer updates the row instead of double-counting.
    fb = session.exec(
        select(Feedback).where(Feedback.match_id == match.id, Feedback.attendee_id == me.id)
    ).first() or Feedback(match_id=match.id, attendee_id=me.id, outcome=body.outcome)
    fb.outcome = body.outcome
    fb.rating = body.rating if body.outcome == "talked" else None
    fb.comment = body.comment
    session.add(fb)
    session.commit()
    return MyFeedback(outcome=fb.outcome, rating=fb.rating)
