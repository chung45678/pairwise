"""Runtime settings, read from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _default_database_url() -> str:
    # Vercel's Neon integration sets DATABASE_URL (and POSTGRES_URL on older setups).
    url = os.getenv("DATABASE_URL") or os.getenv("POSTGRES_URL")
    if url:
        return url
    # Serverless filesystems are read-only except /tmp. Data there is per-instance
    # and temporary: fine for a first deploy, but connect Postgres to keep it.
    if os.getenv("VERCEL"):
        return "sqlite:////tmp/pairwise.db"
    return "sqlite:///./pairwise.db"


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=_default_database_url)
    # Built frontend to serve in production. Ignored if the folder doesn't exist.
    static_dir: Path = field(
        default_factory=lambda: Path(
            os.getenv("PAIRWISE_STATIC_DIR", Path(__file__).parent.parent / "static")
        )
    )
    cors_origins: list[str] = field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",")
    )
    # Optional: LLM icebreakers. Unset means template icebreakers.
    anthropic_api_key: str | None = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY"))
    anthropic_model: str = field(
        default_factory=lambda: os.getenv("PAIRWISE_ICEBREAKER_MODEL", "claude-haiku-5-5")
    )
    # Optional: any OpenAI-compatible embeddings endpoint. Unset means TF-IDF.
    embeddings_url: str | None = field(default_factory=lambda: os.getenv("EMBEDDINGS_URL"))
    embeddings_api_key: str | None = field(default_factory=lambda: os.getenv("EMBEDDINGS_API_KEY"))
    embeddings_model: str = field(
        default_factory=lambda: os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")
    )
    # Public demo: a seeded, read-only event at /e/demo. Its admin key is public on
    # purpose (it's linked from the README), so every write to it is refused.
    # On by default on Vercel, off locally; PAIRWISE_DEMO=0/1 overrides either way.
    demo_enabled: bool = field(
        default_factory=lambda: (
            os.getenv("PAIRWISE_DEMO", "1" if os.getenv("VERCEL") else "").lower()
            in ("1", "true", "yes")
        )
    )
    demo_slug: str = "demo"
    demo_admin_key: str = field(
        default_factory=lambda: os.getenv("PAIRWISE_DEMO_KEY", "try-the-demo")
    )


def get_settings() -> Settings:
    return Settings()
