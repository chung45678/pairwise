"""Request and response models. These define the public API contract."""

from __future__ import annotations

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from pairwise.models import EventStatus, Outcome

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(default="", max_length=1000)
    starts_at: datetime | None = None
    location: str = Field(default="", max_length=200)
    matches_per_person: int = Field(default=2, ge=1, le=5)


class EventUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=1000)
    starts_at: datetime | None = None
    location: str | None = Field(default=None, max_length=200)
    matches_per_person: int | None = Field(default=None, ge=1, le=5)


class EventPublic(BaseModel):
    slug: str
    name: str
    description: str
    starts_at: datetime | None
    location: str
    matches_per_person: int
    status: EventStatus


class EventCreated(EventPublic):
    admin_key: str


class AttendeeAdmin(BaseModel):
    id: int
    name: str
    email: str
    role: str
    affiliation: str
    interests: list[str]
    looking_for: str
    can_help_with: str
    intake_complete: bool
    source: str
    token: str


class EventAdmin(BaseModel):
    event: EventPublic
    attendees: list[AttendeeAdmin]


class IntakeIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=200)
    role: str = Field(default="", max_length=80)
    affiliation: str = Field(default="", max_length=100)
    interests: list[str] = Field(default_factory=list, max_length=10)
    looking_for: str = Field(default="", max_length=500)
    can_help_with: str = Field(default="", max_length=500)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("enter a valid email")
        return v

    @field_validator("interests")
    @classmethod
    def _tags(cls, v: list[str]) -> list[str]:
        seen, out = set(), []
        for t in v:
            t = t.strip()[:40]
            if t and t.lower() not in seen:
                seen.add(t.lower())
                out.append(t)
        return out


class IntakeOut(BaseModel):
    token: str
    updated: bool


class ImportOut(BaseModel):
    added: int
    updated: int
    skipped: list[dict]
    mapping: dict[str, str]
    unmapped_headers: list[str]


class ReasonOut(BaseModel):
    type: str  # complement | shared | roles
    text: str
    terms: list[str] = []


class PersonCard(BaseModel):
    id: int
    name: str
    role: str
    affiliation: str
    interests: list[str]


class MatchOut(BaseModel):
    id: int
    round: int
    score: float
    a: PersonCard
    b: PersonCard
    reasons: list[ReasonOut]
    icebreaker: str
    feedback: list[dict] = []


class MatchStatsOut(BaseModel):
    attendees: int
    matches: int
    coverage: float
    mean_score: float
    min_best_score: float


class MatchRunOut(BaseModel):
    stats: MatchStatsOut
    matches: list[MatchOut]


class MyFeedback(BaseModel):
    outcome: Outcome
    rating: int | None


class MyMatch(BaseModel):
    match_id: int
    round: int
    person: PersonCard
    looking_for: str
    can_help_with: str
    reasons: list[ReasonOut]
    icebreaker: str
    my_feedback: MyFeedback | None


class MeOut(BaseModel):
    event: EventPublic
    name: str
    intake_complete: bool
    published: bool
    matches: list[MyMatch]


class FeedbackIn(BaseModel):
    match_id: int
    outcome: Outcome
    rating: int | None = Field(default=None, ge=1, le=5)
    comment: str = Field(default="", max_length=500)
