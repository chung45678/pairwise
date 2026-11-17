"""Full organizer and attendee flow through the HTTP API."""

from pairwise.synthetic import generate


def intake(client, slug, **over):
    body = {
        "name": "Maya Chen",
        "email": "maya@uwaterloo.ca",
        "role": "PM",
        "interests": ["fintech"],
        "looking_for": "design feedback",
        "can_help_with": "roadmaps",
    }
    body.update(over)
    return client.post(f"/api/events/{slug}/intake", json=body)


def test_admin_routes_require_key(client, event):
    slug = event["slug"]
    assert client.get(f"/api/admin/events/{slug}").status_code == 401
    assert (
        client.get(f"/api/admin/events/{slug}", headers={"X-Admin-Key": "nope"}).status_code == 401
    )
    assert client.get(f"/api/admin/events/{slug}", headers=event["headers"]).status_code == 200
    assert client.get("/api/admin/events/missing", headers=event["headers"]).status_code == 404


def test_public_event_hides_admin_key(client, event):
    body = client.get(f"/api/events/{event['slug']}").json()
    assert "admin_key" not in body
    assert body["status"] == "draft"


def test_intake_validates_and_upserts(client, event):
    slug = event["slug"]
    assert intake(client, slug, email="not-an-email").status_code == 422
    first = intake(client, slug).json()
    second = intake(client, slug, email="MAYA@uwaterloo.ca", role="Designer").json()
    assert first["token"] == second["token"] and second["updated"] is True
    people = client.get(f"/api/admin/events/{slug}", headers=event["headers"]).json()["attendees"]
    assert len(people) == 1 and people[0]["role"] == "Designer"


def test_import_then_intake_merges(client, event, luma_csv):
    slug, h = event["slug"], event["headers"]
    r = client.post(
        f"/api/admin/events/{slug}/import",
        headers=h,
        files={"file": ("guests.csv", luma_csv, "text/csv")},
    )
    assert r.status_code == 200, r.text
    assert r.json()["added"] == 4 and len(r.json()["skipped"]) == 3

    # The quiet guest fills the intake form later: same row, now complete.
    intake(client, slug, name="Quiet Guest", email="quiet@uwaterloo.ca")
    people = client.get(f"/api/admin/events/{slug}", headers=h).json()["attendees"]
    assert len(people) == 4
    quiet = next(p for p in people if p["email"] == "quiet@uwaterloo.ca")
    assert quiet["intake_complete"] and quiet["source"] == "luma"

    # Re-importing never overwrites what attendees typed.
    client.post(
        f"/api/admin/events/{slug}/import",
        headers=h,
        files={"file": ("guests.csv", luma_csv, "text/csv")},
    )
    quiet = next(
        p
        for p in client.get(f"/api/admin/events/{slug}", headers=h).json()["attendees"]
        if p["email"] == "quiet@uwaterloo.ca"
    )
    assert quiet["looking_for"] == "design feedback"


def test_bad_csv_is_rejected(client, event):
    r = client.post(
        f"/api/admin/events/{event['slug']}/import",
        headers=event["headers"],
        files={"file": ("x.csv", b"name\nA\n", "text/csv")},
    )
    assert r.status_code == 422


def test_full_flow(client, event):
    slug, h = event["slug"], event["headers"]
    tokens = {}
    for person in generate(11, seed=3):
        p = person.profile
        r = intake(
            client,
            slug,
            name=p.name,
            email=person.email,
            role=p.role,
            affiliation=p.affiliation,
            interests=list(p.interests),
            looking_for=p.looking_for,
            can_help_with=p.can_help_with,
        )
        tokens[person.email] = r.json()["token"]

    assert client.post(f"/api/admin/events/{slug}/publish", headers=h).status_code == 409

    run = client.post(f"/api/admin/events/{slug}/match", headers=h)
    assert run.status_code == 200, run.text
    stats = run.json()["stats"]
    assert stats["coverage"] == 1.0 and stats["attendees"] == 11
    for m in run.json()["matches"]:
        assert m["reasons"] and m["icebreaker"]
        assert "email" not in m["a"]

    # Draft matches are hidden from attendees.
    token = next(iter(tokens.values()))
    me = client.get(f"/api/me/{token}").json()
    assert me["published"] is False and me["matches"] == []

    assert (
        client.post(f"/api/admin/events/{slug}/publish", headers=h).json()["status"] == "published"
    )
    assert client.post(f"/api/admin/events/{slug}/match", headers=h).status_code == 409

    me = client.get(f"/api/me/{token}").json()
    assert 2 <= len(me["matches"]) <= 3
    first = me["matches"][0]
    assert "email" not in first["person"]

    # Feedback is an upsert, and rating is dropped for non-"talked" outcomes.
    fb = {"match_id": first["match_id"], "outcome": "talked", "rating": 5}
    assert client.post(f"/api/me/{token}/feedback", json=fb).status_code == 200
    fb2 = {"match_id": first["match_id"], "outcome": "missed", "rating": 4}
    assert client.post(f"/api/me/{token}/feedback", json=fb2).json() == {
        "outcome": "missed",
        "rating": None,
    }
    fb3 = {"match_id": first["match_id"], "outcome": "talked", "rating": 4}
    client.post(f"/api/me/{token}/feedback", json=fb3)

    # Can't give feedback on someone else's match.
    other = next(t for t in tokens.values() if t != token)
    other_matches = {m["match_id"] for m in client.get(f"/api/me/{other}").json()["matches"]}
    foreign = next(
        m["id"]
        for m in client.get(f"/api/admin/events/{slug}/matches", headers=h).json()
        if m["id"] not in {x["match_id"] for x in me["matches"]} and m["id"] not in other_matches
    )
    assert (
        client.post(
            f"/api/me/{token}/feedback", json={"match_id": foreign, "outcome": "talked"}
        ).status_code
        == 404
    )

    metrics = client.get(f"/api/admin/events/{slug}/metrics", headers=h).json()
    assert metrics["registered"] == 11 and metrics["coverage"] == 1.0
    assert metrics["gave_feedback"] == 1 and metrics["matches_with_feedback"] == 1
    assert metrics["conversation_rate"] == 1.0 and metrics["avg_rating"] == 4.0

    csv_text = client.get(f"/api/admin/events/{slug}/matches.csv", headers=h).text
    assert csv_text.splitlines()[0].startswith("attendee_name,attendee_email,match_link")
    assert len(csv_text.splitlines()) == 1 + 2 * stats["matches"]


def test_match_needs_two_completed(client, event):
    intake(client, event["slug"])
    r = client.post(f"/api/admin/events/{event['slug']}/match", headers=event["headers"])
    assert r.status_code == 422


def test_delete_attendee_resets_draft(client, event):
    slug, h = event["slug"], event["headers"]
    intake(client, slug)
    intake(client, slug, name="Jordan", email="jordan@uwaterloo.ca", looking_for="roadmaps")
    intake(client, slug, name="Sam", email="sam@uwaterloo.ca", looking_for="python")
    client.post(f"/api/admin/events/{slug}/match", headers=h)
    pid = client.get(f"/api/admin/events/{slug}", headers=h).json()["attendees"][0]["id"]
    assert client.delete(f"/api/admin/events/{slug}/attendees/{pid}", headers=h).status_code == 204
    assert client.get(f"/api/events/{slug}").json()["status"] == "draft"
    assert client.get(f"/api/admin/events/{slug}/matches", headers=h).json() == []


def test_bad_token(client):
    assert client.get("/api/me/nope").status_code == 404


def test_health(client):
    assert client.get("/api/health").json()["ok"] is True


def test_same_first_names_use_full_names(client, event):
    slug, h = event["slug"], event["headers"]
    intake(
        client,
        slug,
        name="Leo Wilson",
        email="lw@x.com",
        looking_for="interview prep",
        can_help_with="react",
    )
    intake(
        client,
        slug,
        name="Leo Tran",
        email="lt@x.com",
        looking_for="react",
        can_help_with="interview prep",
    )
    m = client.post(f"/api/admin/events/{slug}/match", headers=h).json()["matches"][0]
    text = " ".join(r["text"] for r in m["reasons"])
    assert "Leo Wilson" in text and "Leo Tran" in text
