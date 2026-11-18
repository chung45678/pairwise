"""App factory. Run with `uvicorn pairwise.main:create_app --factory`."""

from __future__ import annotations

import contextlib
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.engine import Engine

from pairwise import __version__
from pairwise.api import admin, me, public
from pairwise.config import Settings, get_settings
from pairwise.db import init_db, make_engine


def create_app(settings: Settings | None = None, engine: Engine | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine = engine or make_engine(settings.database_url)
    init_db(engine)

    app = FastAPI(
        title="Pairwise",
        version=__version__,
        description="Open-source event matchmaking for student clubs.",
    )
    app.state.settings = settings
    app.state.engine = engine

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(public.router)
    app.include_router(admin.router)
    app.include_router(me.router)

    @app.get("/api/health", tags=["meta"])
    def health():
        # Which database is live: "sqlite" on Vercel means Postgres isn't connected
        # yet and data only lasts until the instance restarts.
        return {"ok": True, "version": __version__, "database": engine.dialect.name}

    if settings.demo_enabled:
        ensure_demo(engine, settings)
    _mount_spa(app, settings)
    return app


def ensure_demo(engine: Engine, settings: Settings) -> None:
    """Seed the public read-only demo event once. Safe to call on every cold start,
    including two instances starting at the same time."""
    from sqlalchemy.exc import IntegrityError
    from sqlmodel import Session, select

    from pairwise.models import Event
    from pairwise.seed import seed

    with Session(engine) as s:
        if s.exec(select(Event.id).where(Event.slug == settings.demo_slug)).first():
            return
    # If another instance seeded it first, the unique slug stops the duplicate.
    with contextlib.suppress(IntegrityError):
        seed(40, "", engine=engine, slug=settings.demo_slug, admin_key=settings.demo_admin_key)


class SpaCacheHeaders:
    """Caching rules for the built frontend.

    Hashed files under /assets never change, so browsers can keep them forever.
    The HTML must never be served stale: it names the current hashed files, and
    on Vercel every file has the same mtime and index.html keeps the same size
    between builds, so the default ETag (mtime + size) never changes. Browsers
    then got "304 Not Modified" for a new deploy, kept the old HTML, and asked
    for JavaScript that no longer exists: a black page. So HTML gets no
    validators and is always sent fresh (it's under 1 KB).
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path: str = scope["path"]
        if path.startswith("/api/"):
            return await self.app(scope, receive, send)
        is_asset = path.startswith("/assets/")
        if not is_asset:
            scope = dict(scope)
            scope["headers"] = [
                (k, v)
                for k, v in scope["headers"]
                if k not in (b"if-none-match", b"if-modified-since")
            ]

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = [
                    (k, v) for k, v in message.get("headers", []) if k.lower() != b"cache-control"
                ]
                ctype = next((v for k, v in headers if k.lower() == b"content-type"), b"")
                if is_asset and message["status"] == 200:
                    headers.append((b"cache-control", b"public, max-age=31536000, immutable"))
                elif ctype.startswith(b"text/html"):
                    headers = [
                        (k, v) for k, v in headers if k.lower() not in (b"etag", b"last-modified")
                    ]
                    headers.append((b"cache-control", b"no-cache"))
                message = {**message, "headers": headers}
            await send(message)

        return await self.app(scope, receive, send_with_headers)


def _mount_spa(app: FastAPI, settings: Settings) -> None:
    """Serve the built React app. Client-side routes fall back to index.html.

    FastAPI's `app.frontend()` registers the build as low-priority routes (every
    API route wins), and Vercel promotes it to its CDN at build time.
    """
    static = settings.static_dir
    if not (static / "index.html").exists():
        logging.getLogger(__name__).info("No frontend build at %s; API only", static)
        return
    app.add_middleware(SpaCacheHeaders)
    if hasattr(app, "frontend"):
        app.frontend("/", directory=static, fallback="index.html")
        return

    # Older FastAPI: mount assets and add a catch-all.
    if (static / "assets").exists():
        app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        candidate = (static / path).resolve()
        if path and candidate.is_file() and static.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(static / "index.html")
