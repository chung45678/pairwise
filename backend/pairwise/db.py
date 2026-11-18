"""Engine and session management."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import event as sa_event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


def normalize_url(url: str) -> str:
    """Hosted Postgres hands out postgres:// or postgresql:// URLs; SQLAlchemy needs
    the driver named explicitly (we ship psycopg 3)."""
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix) :]
    return url


def make_engine(url: str) -> Engine:
    url = normalize_url(url)
    if url.startswith("sqlite"):
        kwargs: dict = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool  # one shared in-memory DB, used by tests
        engine = create_engine(url, **kwargs)

        @sa_event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):  # SQLite ignores foreign keys unless told otherwise
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine
    # Serverless: many short-lived instances, so keep each one's pool tiny.
    return create_engine(url, pool_pre_ping=True, pool_size=2, max_overflow=2, pool_recycle=300)


def init_db(engine: Engine) -> None:
    from pairwise import models  # noqa: F401  (registers tables)

    SQLModel.metadata.create_all(engine)


def session_factory(engine: Engine):
    def get_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    return get_session
