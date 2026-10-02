.PHONY: install dev prod test seed docker

# ── Installation ────────────────────────────────────────────────────────────
install:
	pip install -r requirements.txt
	pip install pytest pytest-asyncio httpx

# ── Développement ───────────────────────────────────────────────────────────
dev:
	@echo "🚀 Starting AfriSupply API (dev)..."
	uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# ── Production ──────────────────────────────────────────────────────────────
prod:
	@echo "🚀 Starting AfriSupply API (prod)..."
	gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker \
		--bind 0.0.0.0:8000 \
		--timeout 120 \
		--access-logfile - \
		--error-logfile -

# ── Tests ───────────────────────────────────────────────────────────────────
test:
	pytest tests/ -v --tb=short

test-cov:
	pytest tests/ -v --cov=routers --cov=services --cov-report=term-missing

# ── Seed ────────────────────────────────────────────────────────────────────
seed:
	python -c "import asyncio; from seed import run_seed; from database import get_db; asyncio.run(run_seed())"

# ── Docker ──────────────────────────────────────────────────────────────────
docker-build:
	docker build -t afrisupply-api .

docker-run:
	docker run -p 8000:8000 --env-file .env afrisupply-api

docker-compose:
	docker-compose up -d

# ── Lint ────────────────────────────────────────────────────────────────────
lint:
	python -m py_compile main.py
	find . -name "*.py" -not -path "./__pycache__/*" | xargs python -m py_compile