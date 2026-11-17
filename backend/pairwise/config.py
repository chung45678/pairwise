"""Runtime settings, read from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: os.getenv("DATABASE_URL", "sqlite:///./pairwise.db")
    )
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


def get_settings() -> Settings:
    return Settings()
