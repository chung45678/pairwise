from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from pairwise.config import Settings
from pairwise.db import make_engine
from pairwise.main import create_app

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture
def settings(tmp_path) -> Settings:
    return Settings(
        database_url="sqlite://",
        static_dir=tmp_path / "no-frontend",
        cors_origins=["http://localhost:5173"],
        anthropic_api_key=None,
        embeddings_url=None,
    )


@pytest.fixture
def client(settings) -> TestClient:
    app = create_app(settings, make_engine("sqlite://"))
    return TestClient(app)


@pytest.fixture
def event(client) -> dict:
    r = client.post("/api/events", json={"name": "PM x Blueprint Mixer", "matches_per_person": 2})
    assert r.status_code == 201
    body = r.json()
    body["headers"] = {"X-Admin-Key": body["admin_key"]}
    return body


@pytest.fixture
def luma_csv() -> bytes:
    return (FIXTURES / "luma_export.csv").read_bytes()
