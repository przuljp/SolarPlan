# SolarPlan

SolarPlan is a full-stack web application for preliminary analysis and comparison of residential photovoltaic system configurations.

The application combines verified solar-module specifications, deterministic polygon-aware roof-layout optimization, PVGIS energy estimates, and household electricity consumption. V1 focuses on transparent technical and energy analysis; pricing, financial savings, and ROI are explicitly outside its scope.

## Technology stack

- Frontend: React, TypeScript, Vite, React Router, and TanStack Query
- Backend: Python, FastAPI, Pydantic, SQLAlchemy, and Alembic
- Database: PostgreSQL
- Integrations: PVGIS, geocoding, and an OpenAI adapter for explaining verified energy results
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
The backend runs `alembic upgrade head` before starting, so new database tables and verified catalog records are applied automatically when the stack starts.

PVGIS uses the European Commission public API and does not require an API key. The backend calls the versioned endpoint and handles normalization, retry, and caching.


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

The authenticated project workflow, map-based location selection, multi-surface rectangular/trapezoidal roof modeling, verified panel catalog, polygon-aware layouts, PVGIS analysis, household consumption comparison, configuration optimizer, simulation history, and two-simulation comparison are implemented.

Saved simulations can be exported from Production Analysis or Simulation Details using **Download PDF** and **Download CSV**. Reports include the saved system inputs, panels, actual system losses, annual/monthly production, roof contributions, calculation date, and limitations. Exports use the immutable simulation snapshot; they do not request PVGIS again or include the current consumption profile.

The authenticated endpoint is `GET /api/v1/projects/{project_id}/simulations/{simulation_id}/report?format=pdf` (or `format=csv`). Files are generated on demand without a report table or stored files. PDF generation uses ReportLab; CSV is UTF-8 with a BOM for spreadsheet compatibility and neutralizes formulas in user-supplied text. Rebuild the backend image after pulling this feature to install the new dependency: `docker compose up -d --build backend`.

## AI explanations

Production Analysis, saved Simulation Details and Compare Simulations include **Explain results**. It sends allowlisted saved energy/system data to OpenAI only after a user clicks. Names, addresses, coordinates and private resource IDs are excluded. Current household consumption is optional and defaults off; in a two-simulation comparison it is compared with the baseline. Historical production always comes from the selected immutable snapshot.

Add your key to the root `.env` (never to frontend variables):

```dotenv
SOLARPLAN_OPENAI_API_KEY=
SOLARPLAN_OPENAI_MODEL=gpt-5-mini
SOLARPLAN_OPENAI_TIMEOUT_SECONDS=60
SOLARPLAN_OPENAI_MAX_OUTPUT_TOKENS=4000
```

Paste the key after the first equals sign, then reload the backend environment:

```bash
docker compose up -d --force-recreate backend
```

Without a key the rest of SolarPlan works normally and the AI section reports that explanations are unavailable. **Check availability** refreshes this state after setup. The model setting targets a Responses API model supporting Structured Outputs and low reasoning effort; the default is `gpt-5-mini`.

The backend uses the existing `httpx` dependency with the [Responses API and Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses). It sends `store: false`, validates structured output and renders it as plain text. Explanations are qualitative: digit-containing narratives are rejected, while exact values remain in the deterministic result UI. AI cannot modify calculations, layouts or simulations. Timeout, refusal, invalid output and provider failures return controlled errors without exposing credentials or provider error bodies. There are no automatic paid retries.

An owner-scoped, process-local cache keeps up to 128 explanations for an hour; its key includes input data, consumption update time, model and prompt version. New generation requests have a ten-second per-user cooldown and cannot run concurrently for that user. This is development-scale protection, not a distributed rate limiter or persistent chat/history. Restarting the backend clears this cache. No new database migration or Python/Node dependency is required.

Automated tests mock OpenAI. A live smoke test using synthetic energy data also passed: the configured `gpt-5-mini` returned HTTP 200 with a completed response accepted by application validation. Live consumption and two-simulation explanation flows still need end-to-end verification. AI summaries are not inserted into PDF/CSV exports in this increment.

Next: final end-to-end verification, security hardening and deployment.

