"""Import a Luma guest-list CSV export.

Luma exports fixed columns (name, email, approval_status, ...) followed by one
column per custom registration question, with the question text as the header.
Every club words its questions differently, so we map headers by keyword
instead of expecting exact names, and report what we mapped so the organizer
can check it.
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field

# Order matters: the first rule that matches a header wins, and each field maps once.
FIELD_RULES: list[tuple[str, list[str]]] = [
    ("email", [r"^e-?mail( address)?$"]),
    ("name", [r"^(full )?name$"]),
    ("first_name", [r"^first[ _]?name$"]),
    ("last_name", [r"^last[ _]?name$"]),
    ("approval_status", [r"approval[ _]status"]),
    (
        "looking_for",
        [
            r"looking for",
            r"hope to (get|meet|learn)",
            r"want to (meet|learn)",
            r"who .*meet",
            r"goal",
        ],
    ),
    (
        "can_help_with",
        [
            r"help (others|with|people)",
            r"can (you )?offer",
            r"expertise",
            r"could teach",
            r"ask you about",
        ],
    ),
    ("interests", [r"interest", r"topics", r"passionate"]),
    ("role", [r"\brole\b", r"program", r"major", r"position", r"what do you do", r"title"]),
    # Not "school": at a club event everyone has the same school, and a shared
    # affiliation triggers a "probably already know each other" penalty.
    ("affiliation", [r"team", r"company", r"club", r"organi[sz]ation"]),
]

SKIP_STATUSES = {"declined", "rejected", "waitlist", "invited", "pending_approval"}


@dataclass
class ImportedGuest:
    name: str
    email: str
    role: str = ""
    affiliation: str = ""
    interests: list[str] = field(default_factory=list)
    looking_for: str = ""
    can_help_with: str = ""

    @property
    def has_intake(self) -> bool:
        return bool(self.interests or self.looking_for or self.can_help_with)


@dataclass
class ImportReport:
    mapping: dict[str, str]  # our field -> CSV header
    guests: list[ImportedGuest]
    skipped: list[dict]  # {"row": n, "reason": str}
    unmapped_headers: list[str]


def map_headers(headers: list[str]) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for header in headers:
        h = header.strip().lower()
        for field_name, patterns in FIELD_RULES:
            if field_name in mapping:
                continue
            if any(re.search(p, h) for p in patterns):
                mapping[field_name] = header
                break
    return mapping


def split_tags(raw: str) -> list[str]:
    parts = re.split(r"[,;/|\n]+", raw)
    seen, out = set(), []
    for p in parts:
        tag = p.strip().strip(".")
        if tag and tag.lower() not in seen:
            seen.add(tag.lower())
            out.append(tag)
    return out[:10]


def parse_luma_csv(content: bytes | str) -> ImportReport:
    text = content.decode("utf-8-sig", errors="replace") if isinstance(content, bytes) else content
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    mapping = map_headers(headers)
    if "email" not in mapping:
        raise ValueError("CSV has no email column. Export the guest list from Luma.")

    guests: list[ImportedGuest] = []
    skipped: list[dict] = []
    seen_emails: set[str] = set()

    def get(row: dict, f: str) -> str:
        col = mapping.get(f)
        return (row.get(col) or "").strip() if col else ""

    for n, row in enumerate(reader, start=2):  # row 1 is the header
        email = get(row, "email").lower()
        status = get(row, "approval_status").lower()
        if not email or "@" not in email:
            skipped.append({"row": n, "reason": "missing or invalid email"})
            continue
        if status in SKIP_STATUSES:
            skipped.append({"row": n, "reason": f"status is {status}"})
            continue
        if email in seen_emails:
            skipped.append({"row": n, "reason": "duplicate email"})
            continue
        seen_emails.add(email)

        name = (
            get(row, "name")
            or " ".join(x for x in (get(row, "first_name"), get(row, "last_name")) if x)
            or email.split("@")[0]
        )

        guests.append(
            ImportedGuest(
                name=name,
                email=email,
                role=get(row, "role"),
                affiliation=get(row, "affiliation"),
                interests=split_tags(get(row, "interests")),
                looking_for=get(row, "looking_for"),
                can_help_with=get(row, "can_help_with"),
            )
        )

    used = set(mapping.values())
    return ImportReport(
        mapping=mapping,
        guests=guests,
        skipped=skipped,
        unmapped_headers=[h for h in headers if h not in used],
    )
