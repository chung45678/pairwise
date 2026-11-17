"""App factory. Run with `uvicorn pairwise.main:create_app --factory`."""

from __future__ import annotations

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
        return {"ok": True, "version": __version__}

    _mount_spa(app, settings)
    return app


def _mount_spa(app: FastAPI, settings: Settings) -> None:
    """Serve the built React app, falling back to index.html for client-side routes."""
    static = settings.static_dir
    index = static / "index.html"
    if not index.exists():
        logging.getLogger(__name__).info("No frontend build at %s; API only", static)
        return
    if (static / "assets").exists():
        app.mount("/assets", StaticFiles(directory=static / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404)
        candidate = (static / path).resolve()
        if path and candidate.is_file() and static.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(index)
