"""Organizer routes. Every route requires the event's admin key."""

from __future__ import annotations

import csv
import io

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session, col, delete, select

from pairwise.api.deps import get_session, require_admin
from pairwise.api.serializers import attendee_admin, event_public, match_out, pair_names
from pairwise.importers import parse_luma_csv
from pairwise.matching import Profile, run_matching
from pairwise.matching.explain import render_reason
from pairwise.matching.pipeline import encoder_from_settings, writer_from_settings
from pairwise.metrics import compute_metrics
from pairwise.models import Attendee, Event, EventStatus, Feedback, Match
from pairwise.schemas import EventAdmin, EventPublic, EventUpdate, ImportOut, MatchOut, MatchRunOut

router = APIRouter(prefix="/api/admin/events/{slug}", tags=["admin"])

MAX_CSV_BYTES = 2 * 1024 * 1024


def _people(session: Session, event: Event) -> dict[int, Attendee]:
    rows = session.exec(select(Attendee).where(Attendee.event_id == event.id)).all()
    return {a.id: a for a in rows}


def _matches(session: Session, event: Event) -> list[Match]:
    return list(
        session.exec(
            select(Match)
            .where(Match.event_id == event.id)
            .order_by(Match.round, col(Match.score).desc())
        ).all()
    )


def _feedback_by_match(session: Session, match_ids: list[int]) -> dict[int, list[Feedback]]:
    out: dict[int, list[Feedback]] = {mid: [] for mid in match_ids}
    if match_ids:
        for f in session.exec(select(Feedback).where(col(Feedback.match_id).in_(match_ids))):
            out[f.match_id].append(f)
    return out


@router.get("", response_model=EventAdmin)
def read_event_admin(
    event: Event = Depends(require_admin), session: Session = Depends(get_session)
):
    people = sorted(_people(session, event).values(), key=lambda a: a.created_at)
    return EventAdmin(event=event_public(event), attendees=[attendee_admin(a) for a in people])


@router.patch("", response_model=EventPublic)
def update_event(
    body: EventUpdate,
    event: Event = Depends(require_admin),
    session: Session = Depends(get_session),
):
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(event, k, v)
    session.add(event)
    session.commit()
    session.refresh(event)
    return event_public(event)


@router.post("/import", response_model=ImportOut)
async def import_luma(
    file: UploadFile = File(...),
    event: Event = Depends(require_admin),
    session: Session = Depends(get_session),
):
    content = await file.read(MAX_CSV_BYTES + 1)
    if len(content) > MAX_CSV_BYTES:
        raise HTTPException(413, "CSV is larger than 2 MB")
    try:
        report = parse_luma_csv(content)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    by_email = {a.email: a for a in _people(session, event).values()}
    added = updated = 0
    for g in report.guests:
        a = by_email.get(g.email)
        if a is None:
            a = Attendee(event_id=event.id, name=g.name, email=g.email, source="luma")
            added += 1
        else:
            updated += 1
        # Only fill blanks: never overwrite what an attendee typed in the intake form.
        for field_name in ("name", "role", "affiliation", "looking_for", "can_help_with"):
            if not getattr(a, field_name) and getattr(g, field_name):
                setattr(a, field_name, getattr(g, field_name))
        if not a.interests and g.interests:
            a.interests = g.interests
        a.intake_complete = a.intake_complete or g.has_intake
        session.add(a)
    session.commit()
    return ImportOut(
        added=added,
        updated=updated,
        skipped=report.skipped,
        mapping=report.mapping,
        unmapped_headers=report.unmapped_headers,
    )


@router.delete("/attendees/{attendee_id}", status_code=204)
def delete_attendee(
    attendee_id: int, event: Event = Depends(require_admin), session: Session = Depends(get_session)
):
    if event.status == EventStatus.published:
        raise HTTPException(409, "Can't remove attendees after matches are published")
    a = session.get(Attendee, attendee_id)
    if not a or a.event_id != event.id:
        raise HTTPException(404, "Attendee not found")
    session.exec(delete(Match).where(Match.event_id == event.id))
    session.delete(a)
    if event.status == EventStatus.matched:
        event.status = EventStatus.draft  # their matches are gone, so the draft is stale
        session.add(event)
    session.commit()


@router.post("/match", response_model=MatchRunOut)
def generate_matches(
    request: Request, event: Event = Depends(require_admin), session: Session = Depends(get_session)
):
    if event.status == EventStatus.published:
        raise HTTPException(409, "Matches are already published")
    people = _people(session, event)
    eligible = [a for a in people.values() if a.intake_complete]
    if len(eligible) < 2:
        raise HTTPException(422, "Need at least 2 attendees with a completed intake")

    settings = request.app.state.settings
    profiles = [
        Profile(
            id=a.id,
            name=a.name,
            role=a.role,
            affiliation=a.affiliation,
            interests=tuple(a.interests or []),
            looking_for=a.looking_for,
            can_help_with=a.can_help_with,
        )
        for a in sorted(eligible, key=lambda a: a.id)
    ]
    results, stats = run_matching(
        profiles,
        event.matches_per_person,
        encoder=encoder_from_settings(settings),
        writer=writer_from_settings(settings),
    )

    session.exec(delete(Match).where(Match.event_id == event.id))
    rows = [
        Match(
            event_id=event.id,
            a_id=r.a_id,
            b_id=r.b_id,
            score=r.score,
            round=r.round,
            reasons=r.reasons,
            icebreaker=r.icebreaker,
        )
        for r in results
    ]
    session.add_all(rows)
    event.status = EventStatus.matched
    session.add(event)
    session.commit()

    matches = _matches(session, event)
    return MatchRunOut(
        stats=stats.__dict__,
        matches=[match_out(m, people, []) for m in matches],
    )


@router.get("/matches", response_model=list[MatchOut])
def list_matches(event: Event = Depends(require_admin), session: Session = Depends(get_session)):
    people = _people(session, event)
    matches = _matches(session, event)
    fb = _feedback_by_match(session, [m.id for m in matches])
    return [match_out(m, people, fb[m.id]) for m in matches]


@router.post("/publish", response_model=EventPublic)
def publish(event: Event = Depends(require_admin), session: Session = Depends(get_session)):
    if event.status == EventStatus.draft:
        raise HTTPException(409, "Generate matches before publishing")
    event.status = EventStatus.published
    session.add(event)
    session.commit()
    session.refresh(event)
    return event_public(event)


@router.get("/matches.csv")
def export_matches(
    request: Request, event: Event = Depends(require_admin), session: Session = Depends(get_session)
):
    """One row per attendee per match, ready for a mail merge or Slack workflow."""
    people = _people(session, event)
    base = str(request.base_url).rstrip("/")
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(
        [
            "attendee_name",
            "attendee_email",
            "match_link",
            "round",
            "match_name",
            "match_role",
            "why",
            "icebreaker",
        ]
    )
    for m in _matches(session, event):
        for me_id, other_id in ((m.a_id, m.b_id), (m.b_id, m.a_id)):
            me, other = people[me_id], people[other_id]
            names = pair_names(me, other)
            why = " ".join(render_reason(r, names, viewer=me_id) for r in m.reasons)
            w.writerow(
                [
                    me.name,
                    me.email,
                    f"{base}/m/{me.token}",
                    m.round,
                    other.name,
                    other.role,
                    why,
                    m.icebreaker,
                ]
            )
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{event.slug}-matches.csv"'},
    )


@router.get("/metrics")
def metrics(event: Event = Depends(require_admin), session: Session = Depends(get_session)):
    people = list(_people(session, event).values())
    matches = _matches(session, event)
    fb = [f for fs in _feedback_by_match(session, [m.id for m in matches]).values() for f in fs]
    return compute_metrics(people, matches, fb).to_dict()
