"""Database tables."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import JSON, Column, UniqueConstraint
from sqlmodel import Field, SQLModel


def _now() -> datetime:
    return datetime.now(UTC)


def new_secret() -> str:
    """128-bit URL-safe secret for admin keys and attendee links."""
    return secrets.token_urlsafe(16)


class EventStatus(StrEnum):
    draft = "draft"
    matched = "matched"
    published = "published"


class Outcome(StrEnum):
    talked = "talked"
    missed = "missed"
    skipped = "skipped"


class Event(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(index=True, unique=True)
    admin_key: str = Field(default_factory=new_secret)
    name: str
    description: str = ""
    starts_at: datetime | None = None
    location: str = ""
    matches_per_person: int = 2
    status: EventStatus = EventStatus.draft
    created_at: datetime = Field(default_factory=_now)


class Attendee(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("event_id", "email"),)

    id: int | None = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="event.id", index=True)
    name: str
    email: str = Field(index=True)
    role: str = ""
    affiliation: str = ""
    interests: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    looking_for: str = ""
    can_help_with: str = ""
    token: str = Field(default_factory=new_secret, index=True, unique=True)
    intake_complete: bool = False
    source: str = "intake"
    created_at: datetime = Field(default_factory=_now)


class Match(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    event_id: int = Field(foreign_key="event.id", index=True)
    a_id: int = Field(foreign_key="attendee.id")
    b_id: int = Field(foreign_key="attendee.id")
    score: float
    round: int
    reasons: list[dict] = Field(default_factory=list, sa_column=Column(JSON))
    icebreaker: str = ""


class Feedback(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("match_id", "attendee_id"),)

    id: int | None = Field(default=None, primary_key=True)
    match_id: int = Field(foreign_key="match.id", index=True)
    attendee_id: int = Field(foreign_key="attendee.id")
    outcome: Outcome
    rating: int | None = None
    comment: str = ""
    created_at: datetime = Field(default_factory=_now)
