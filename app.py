"""Vercel entrypoint.

Vercel looks for a FastAPI instance named `app` in a root-level app.py. The real
code lives in backend/pairwise, and the built React app in frontend/dist (the
build command in vercel.json creates it before this module is loaded).
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "backend"))

from pairwise.config import Settings  # noqa: E402
from pairwise.main import create_app  # noqa: E402

app = create_app(Settings(static_dir=ROOT / "frontend" / "dist"))
