"""Shared route dependencies: DB session and the two kinds of link-based auth."""

from __future__ import annotations

import hmac
from collections.abc import Iterator

from fastapi import Depends, Header, HTTPException, Request
from sqlmodel import Session, select

from pairwise.models import Attendee, Event


def get_session(request: Request) -> Iterator[Session]:
    with Session(request.app.state.engine) as session:
        yield session


def get_event(slug: str, session: Session = Depends(get_session)) -> Event:
    event = session.exec(select(Event).where(Event.slug == slug)).first()
    if not event:
        raise HTTPException(404, "Event not found")
    return event


def require_admin(
    event: Event = Depends(get_event),
    x_admin_key: str | None = Header(default=None),
) -> Event:
    # Constant-time compare so response timing can't leak the key.
    if not x_admin_key or not hmac.compare_digest(x_admin_key, event.admin_key):
        raise HTTPException(401, "Invalid admin key")
    return event


def get_attendee_by_token(token: str, session: Session = Depends(get_session)) -> Attendee:
    attendee = session.exec(select(Attendee).where(Attendee.token == token)).first()
    if not attendee:
        raise HTTPException(404, "This link isn't valid. Ask the organizer for a new one.")
    return attendee
