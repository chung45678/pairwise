"""Engine and session management."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import event as sa_event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine


def make_engine(url: str) -> Engine:
    if url.startswith("sqlite"):
        kwargs: dict = {"connect_args": {"check_same_thread": False}}
        if url in ("sqlite://", "sqlite:///:memory:"):
            kwargs["poolclass"] = StaticPool  # one shared in-memory DB, used by tests
        engine = create_engine(url, **kwargs)

        @sa_event.listens_for(engine, "connect")
        def _fk_on(dbapi_conn, _):  # SQLite ignores foreign keys unless told otherwise
            dbapi_conn.execute("PRAGMA foreign_keys=ON")

        return engine
    return create_engine(url, pool_pre_ping=True)


def init_db(engine: Engine) -> None:
    from pairwise import models  # noqa: F401  (registers tables)

    SQLModel.metadata.create_all(engine)


def session_factory(engine: Engine):
    def get_session() -> Iterator[Session]:
        with Session(engine) as session:
            yield session

    return get_session
