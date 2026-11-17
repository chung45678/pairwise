"""Public routes: create an event, view it, and submit the intake form."""

from __future__ import annotations

import re
import secrets

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from pairwise.api.deps import get_event, get_session
from pairwise.api.serializers import event_public
from pairwise.models import Attendee, Event
from pairwise.schemas import EventCreate, EventCreated, EventPublic, IntakeIn, IntakeOut

router = APIRouter(prefix="/api", tags=["public"])


def make_slug(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:40] or "event"
    return f"{base}-{secrets.token_hex(2)}"


@router.post("/events", response_model=EventCreated, status_code=201)
def create_event(body: EventCreate, session: Session = Depends(get_session)):
    event = Event(slug=make_slug(body.name), **body.model_dump())
    session.add(event)
    session.commit()
    session.refresh(event)
    return EventCreated(**event_public(event).model_dump(), admin_key=event.admin_key)


@router.get("/events/{slug}", response_model=EventPublic)
def read_event(event: Event = Depends(get_event)):
    return event_public(event)


@router.post("/events/{slug}/intake", response_model=IntakeOut)
def submit_intake(
    body: IntakeIn, event: Event = Depends(get_event), session: Session = Depends(get_session)
):
    """Create or update an attendee. Matched by email so a Luma import and an intake
    submission from the same person merge into one row."""
    existing = session.exec(
        select(Attendee).where(Attendee.event_id == event.id, Attendee.email == body.email)
    ).first()
    data = body.model_dump()
    complete = bool(body.interests or body.looking_for.strip() or body.can_help_with.strip())

    if existing:
        for key, value in data.items():
            setattr(existing, key, value)
        existing.intake_complete = complete
        attendee, updated = existing, True
    else:
        attendee = Attendee(event_id=event.id, intake_complete=complete, source="intake", **data)
        updated = False
    session.add(attendee)
    session.commit()
    session.refresh(attendee)
    return IntakeOut(token=attendee.token, updated=updated)
