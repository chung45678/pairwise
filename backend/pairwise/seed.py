"""Create a demo event with synthetic attendees, matches and simulated feedback.

    python -m pairwise.seed [--n 40] [--base-url http://localhost:8000]

Prints the organizer link and one attendee link so you can click through the app.
"""

from __future__ import annotations

import argparse
import random
import secrets
from datetime import UTC, datetime, timedelta

from sqlmodel import Session

from pairwise.config import get_settings
from pairwise.db import init_db, make_engine
from pairwise.matching import Profile, run_matching
from pairwise.models import Attendee, Event, EventStatus, Feedback, Match, Outcome
from pairwise.synthetic import generate, true_value


def seed(
    n: int,
    base_url: str,
    with_feedback: bool = True,
    engine=None,
    slug: str | None = None,
    admin_key: str | None = None,
) -> dict:
    if engine is None:
        engine = make_engine(get_settings().database_url)
    init_db(engine)
    rng = random.Random(7)
    people = generate(n, seed=42)

    with Session(engine) as s:
        event = Event(
            # Random suffix: the seeded rng would give the same slug every run,
            # so running `make seed` twice used to crash on the unique slug.
            slug=slug or f"demo-mixer-{secrets.token_hex(3)}",
            name="PM x Blueprint Winter Mixer",
            description="Meet the people building things at Waterloo. Pairwise will "
            "suggest two people worth meeting.",
            starts_at=datetime.now(UTC) - timedelta(days=1),  # in the past so feedback shows
            location="E7 4th floor",
            matches_per_person=2,
        )
        if admin_key:
            event.admin_key = admin_key
        s.add(event)
        s.commit()
        s.refresh(event)

        rows = []
        for sp in people:
            p = sp.profile
            rows.append(
                Attendee(
                    event_id=event.id,
                    name=p.name,
                    email=sp.email,
                    role=p.role,
                    affiliation=p.affiliation,
                    interests=list(p.interests),
                    looking_for=p.looking_for,
                    can_help_with=p.can_help_with,
                    intake_complete=True,
                    source=rng.choice(["luma", "intake"]),
                )
            )
        s.add_all(rows)
        s.commit()
        for r in rows:
            s.refresh(r)

        truth = {r.id: sp for r, sp in zip(rows, people, strict=True)}
        profiles = [
            Profile(
                r.id,
                r.name,
                r.role,
                r.affiliation,
                tuple(r.interests),
                r.looking_for,
                r.can_help_with,
            )
            for r in rows
        ]
        results, _ = run_matching(profiles, event.matches_per_person)
        matches = [
            Match(
                event_id=event.id,
                a_id=m.a_id,
                b_id=m.b_id,
                score=m.score,
                round=m.round,
                reasons=m.reasons,
                icebreaker=m.icebreaker,
            )
            for m in results
        ]
        s.add_all(matches)
        event.status = EventStatus.published
        s.add(event)
        s.commit()

        if with_feedback:
            # About 45% of attendees respond. Better true matches talk more and rate higher.
            for m in matches:
                s.refresh(m)
                value = true_value(truth[m.a_id], truth[m.b_id])
                for pid in (m.a_id, m.b_id):
                    if rng.random() > 0.45:
                        continue
                    p_talk = min(0.9, 0.3 + 0.25 * value)
                    if rng.random() < p_talk:
                        rating = max(1, min(5, round(2.6 + 0.8 * value + rng.gauss(0, 0.7))))
                        s.add(
                            Feedback(
                                match_id=m.id,
                                attendee_id=pid,
                                outcome=Outcome.talked,
                                rating=rating,
                            )
                        )
                    else:
                        s.add(
                            Feedback(
                                match_id=m.id,
                                attendee_id=pid,
                                outcome=rng.choice([Outcome.missed, Outcome.skipped]),
                            )
                        )
            s.commit()

        base = base_url.rstrip("/")
        return {
            "admin": f"{base}/e/{event.slug}/admin#key={event.admin_key}",
            "join": f"{base}/e/{event.slug}/join",
            "attendee": f"{base}/m/{rows[0].token}",
        }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--n", type=int, default=40)
    ap.add_argument("--base-url", default="http://localhost:5173")
    ap.add_argument("--no-feedback", action="store_true")
    args = ap.parse_args()
    links = seed(args.n, args.base_url, not args.no_feedback)
    print("Demo event created.\n")
    print(f"  Organizer dashboard: {links['admin']}")
    print(f"  Intake form:         {links['join']}")
    print(f"  An attendee's page:  {links['attendee']}")


if __name__ == "__main__":
    main()
