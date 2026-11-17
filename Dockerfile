# One image: build the React app, then serve it from FastAPI.

FROM node:22-slim AS web
WORKDIR /web
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    DATABASE_URL=sqlite:////data/pairwise.db \
    PAIRWISE_STATIC_DIR=/app/static \
    PORT=8000
WORKDIR /app
COPY backend/pyproject.toml ./
COPY backend/pairwise ./pairwise
RUN pip install --no-cache-dir ".[postgres]" && mkdir -p /data
COPY --from=web /web/dist ./static
RUN useradd --create-home app && chown -R app /data
USER app
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request,os; urllib.request.urlopen(f'http://localhost:{os.environ[\"PORT\"]}/api/health')"
CMD ["sh", "-c", "uvicorn pairwise.main:create_app --factory --host 0.0.0.0 --port ${PORT}"]
