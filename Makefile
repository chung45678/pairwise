.PHONY: setup dev api web test lint bench seed build docker

VENV := .venv
PY := $(VENV)/bin/python
# Override if your default python3 is too old: make setup PYTHON=python3.12
PYTHON ?= python3

setup:            ## Install everything
	@$(PYTHON) -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)' || \
	  { echo "Pairwise needs Python 3.11+, but $(PYTHON) is $$($(PYTHON) --version 2>&1)."; \
	    echo "Install it (Mac: brew install python@3.12), then run: make setup PYTHON=python3.12"; exit 1; }
	@command -v npm >/dev/null || { echo "Node.js 20+ is required (Mac: brew install node)."; exit 1; }
	rm -rf $(VENV)
	$(PYTHON) -m venv $(VENV)
	$(PY) -m pip install -e "backend[dev]"
	cd frontend && npm install

api:              ## Run the API on :8000 with reload
	cd backend && ../$(VENV)/bin/uvicorn pairwise.main:create_app --factory --reload --port 8000

web:              ## Run the frontend on :5173 (proxies /api to :8000)
	cd frontend && npm run dev

dev:              ## Run API and frontend together
	$(MAKE) -j2 api web

test:             ## Backend + frontend tests
	cd backend && ../$(PY) -m pytest -q
	cd frontend && npm test

lint:
	cd backend && ../$(VENV)/bin/ruff check . && ../$(VENV)/bin/ruff format --check .
	cd frontend && npm run typecheck

bench:            ## Regenerate docs/BENCHMARK.md
	cd backend && ../$(PY) -m benchmarks.run

seed:             ## Create a demo event with 40 guests and simulated feedback
	cd backend && ../$(PY) -m pairwise.seed

build:
	cd frontend && npm run build

docker:
	docker build -t pairwise . && docker run --rm -p 8000:8000 -v pairwise-data:/data pairwise
