"""The matching engine's view of an attendee, decoupled from the database."""

from __future__ import annotations

import re
from dataclasses import dataclass, field


def normalize_tag(tag: str) -> str:
    return re.sub(r"\s+", " ", tag.strip().lower())


@dataclass(frozen=True)
class Profile:
    id: int
    name: str
    role: str = ""
    affiliation: str = ""
    interests: tuple[str, ...] = field(default_factory=tuple)
    looking_for: str = ""
    can_help_with: str = ""

    @property
    def first_name(self) -> str:
        return self.name.split()[0] if self.name.strip() else "Someone"

    @property
    def tag_set(self) -> frozenset[str]:
        return frozenset(normalize_tag(t) for t in self.interests if t.strip())

    @property
    def interests_text(self) -> str:
        return ", ".join(self.interests)
