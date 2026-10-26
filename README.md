# SolarPlan

SolarPlan is a full-stack web application for preliminary analysis and comparison of residential photovoltaic system configurations.

The application will combine verified solar-module specifications, deterministic rectangular roof-layout optimization, PVGIS energy estimates, weather context, and household electricity consumption. V1 focuses on transparent technical and energy analysis; pricing, financial savings, and ROI are explicitly outside its scope.

## Technology stack

- Frontend: React, TypeScript, Vite, React Router, and TanStack Query
- Backend: Python, FastAPI, Pydantic, SQLAlchemy, and Alembic
- Database: PostgreSQL
- Integrations: PVGIS, Open-Meteo, geocoding, and an optional OpenAI adapter
- Tooling: Docker Compose, Pytest, Vitest, and GitHub Actions

## Repository structure

```text
SolarPlan/
├── backend/              FastAPI application and tests
├── frontend/             React application and tests
├── docs/                 Version-controlled project documentation
├── .env.example          Local configuration template
└── docker-compose.yml    Local development stack
```

The private master specification is intentionally excluded from Git.

## Run with Docker

1. Copy `.env.example` to `.env`.
2. Run `docker compose up --build`.
3. Open the frontend at <http://localhost:5173>.
4. Open the backend documentation at <http://localhost:8000/docs>.

PostgreSQL is exposed on port `5432`, the API on `8000`, and the frontend development server on `5173`.

Stop the stack with `docker compose down`. To also remove the local database volume, run `docker compose down -v`.

## Run without Docker

### Backend

```bash
cd backend
python -m venv .venv
# Activate the virtual environment for your shell.
python -m pip install -e ".[dev]"
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Tests

```bash
cd backend
pytest

cd ../frontend
npm test
```

## Current status

The initial development foundation is in place: Docker Compose, PostgreSQL, a FastAPI health endpoint, a React shell, and basic backend/frontend tests. Domain modules will be introduced incrementally according to the project roadmap.


