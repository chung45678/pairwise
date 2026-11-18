"""Deployment concerns: hosted Postgres URLs, the read-only public demo, SPA serving,
and (when a Postgres URL is provided) the full flow against real Postgres."""

import os

import pytest
from fastapi.testclient import TestClient

from pairwise.config import Settings
from pairwise.db import make_engine, normalize_url
from pairwise.main import create_app


def test_normalize_hosted_postgres_urls():
    assert (
        normalize_url("postgres://u:p@h/db?sslmode=require")
        == "postgresql+psycopg://u:p@h/db?sslmode=require"
    )
    assert normalize_url("postgresql://u:p@h/db") == "postgresql+psycopg://u:p@h/db"
    assert normalize_url("postgresql+psycopg://u@h/db") == "postgresql+psycopg://u@h/db"
    assert normalize_url("sqlite:///./x.db") == "sqlite:///./x.db"


def test_vercel_defaults_to_tmp_sqlite(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("POSTGRES_URL", raising=False)
    monkeypatch.setenv("VERCEL", "1")
    assert Settings().database_url == "sqlite:////tmp/pairwise.db"
    monkeypatch.setenv("POSTGRES_URL", "postgres://h/db")
    assert Settings().database_url == "postgres://h/db"


def demo_client(tmp_path) -> TestClient:
    settings = Settings(
        database_url="sqlite://",
        static_dir=tmp_path / "none",
        demo_enabled=True,
        demo_admin_key="public-key",
    )
    return TestClient(create_app(settings, make_engine("sqlite://")))


def test_demo_is_seeded_once_and_readable(tmp_path):
    client = demo_client(tmp_path)
    h = {"X-Admin-Key": "public-key"}
    body = client.get("/api/admin/events/demo", headers=h).json()
    assert body["event"]["status"] == "published" and len(body["attendees"]) == 40
    assert client.get("/api/admin/events/demo/metrics", headers=h).json()["conversation_rate"]
    # A second app on the same database doesn't seed again.
    app2 = create_app(client.app.state.settings, client.app.state.engine)
    assert len(TestClient(app2).get("/api/admin/events/demo", headers=h).json()["attendees"]) == 40


def test_demo_refuses_every_write(tmp_path):
    client = demo_client(tmp_path)
    h = {"X-Admin-Key": "public-key"}
    assert (
        client.patch("/api/admin/events/demo", headers=h, json={"name": "hacked"}).status_code
        == 403
    )
    assert client.post("/api/admin/events/demo/match", headers=h).status_code == 403
    assert (
        client.post(
            "/api/admin/events/demo/import",
            headers=h,
            files={"file": ("x.csv", b"email\na@b.co\n")},
        ).status_code
        == 403
    )
    intake = {"name": "X", "email": "x@y.co", "interests": ["ai"]}
    assert client.post("/api/events/demo/intake", json=intake).status_code == 403

    attendee = client.get("/api/admin/events/demo", headers=h).json()["attendees"][0]
    me = client.get(f"/api/me/{attendee['token']}").json()
    fb = {"match_id": me["matches"][0]["match_id"], "outcome": "talked", "rating": 5}
    assert client.post(f"/api/me/{attendee['token']}/feedback", json=fb).status_code == 403

    # Other events are unaffected.
    ev = client.post("/api/events", json={"name": "Mine"}).json()
    assert client.post(f"/api/events/{ev['slug']}/intake", json=intake).status_code == 200


def test_spa_served_with_client_side_fallback(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><div id=root></div>")
    (dist / "assets" / "app.js").write_text("console.log(1)")
    app = create_app(Settings(database_url="sqlite://", static_dir=dist), make_engine("sqlite://"))
    c = TestClient(app)
    nav = {"Accept": "text/html"}
    assert "id=root" in c.get("/", headers=nav).text
    assert "id=root" in c.get("/e/abc/join", headers=nav).text  # client-side route
    assert c.get("/assets/app.js").text == "console.log(1)"
    assert c.get("/api/health").json()["ok"] is True  # API wins over the frontend
    assert c.get("/api/nope").status_code == 404


@pytest.mark.skipif(
    not os.getenv("PAIRWISE_TEST_POSTGRES"), reason="set PAIRWISE_TEST_POSTGRES to a Postgres URL"
)
def test_full_flow_on_postgres():
    from sqlmodel import SQLModel

    url = os.environ["PAIRWISE_TEST_POSTGRES"]
    engine = make_engine(url)
    SQLModel.metadata.drop_all(engine)
    app = create_app(
        Settings(database_url=url, static_dir=__import__("pathlib").Path("/nope")), engine
    )
    c = TestClient(app)
    ev = c.post("/api/events", json={"name": "PG night"}).json()
    h = {"X-Admin-Key": ev["admin_key"]}
    for i, (want, offer) in enumerate(
        [("design feedback", "python"), ("python", "design feedback"), ("ml", "sql")]
    ):
        c.post(
            f"/api/events/{ev['slug']}/intake",
            json={
                "name": f"P{i}",
                "email": f"p{i}@x.co",
                "interests": ["ai"],
                "looking_for": want,
                "can_help_with": offer,
            },
        )
    run = c.post(f"/api/admin/events/{ev['slug']}/match", headers=h)
    assert run.status_code == 200 and run.json()["stats"]["coverage"] == 1.0
    assert (
        c.post(f"/api/admin/events/{ev['slug']}/publish", headers=h).json()["status"] == "published"
    )
    assert c.get(f"/api/admin/events/{ev['slug']}/metrics", headers=h).status_code == 200
    SQLModel.metadata.drop_all(engine)


def test_demo_links(tmp_path):
    client = demo_client(tmp_path)
    links = client.get("/api/demo").json()
    assert links["enabled"] and links["admin"] == "/e/demo/admin#key=public-key"
    assert client.get("/api" + links["guest"].replace("/m/", "/me/")).status_code == 200


def test_demo_links_when_disabled(client):
    assert client.get("/api/demo").json() == {"enabled": False}


def test_html_is_never_served_stale(tmp_path):
    """Regression: a redeploy left browsers on old HTML pointing at deleted JS."""
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text('<script src="/assets/app-v1.js"></script>')
    (dist / "assets" / "app-v1.js").write_text("1")
    app = create_app(Settings(database_url="sqlite://", static_dir=dist), make_engine("sqlite://"))
    c = TestClient(app)
    nav = {"Accept": "text/html"}

    first = c.get("/", headers=nav)
    assert first.headers["cache-control"] == "no-cache"
    assert "etag" not in first.headers and "last-modified" not in first.headers

    # Even if the browser sends validators from an old copy, it gets a full 200.
    stale = c.get(
        "/e/x/join",
        headers={
            **nav,
            "If-None-Match": '"anything"',
            "If-Modified-Since": "Sat, 20 Oct 2018 01:46:40 GMT",
        },
    )
    assert stale.status_code == 200 and "app-v1.js" in stale.text

    asset = c.get("/assets/app-v1.js")
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    assert c.get("/api/health").headers.get("cache-control") != "no-cache"
