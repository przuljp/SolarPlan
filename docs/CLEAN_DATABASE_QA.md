# Clean database QA — 12 November 2026

Verified commit: `28ed04f` (including the committed navigation changes).

## Isolation

A separate Compose project, `solarplan-clean-qa`, ran PostgreSQL 17 with an empty
tmpfs data directory, the current backend source and the current frontend source.
QA endpoints were bound only to localhost: API 18000, frontend 15173. Existing
application containers and database volumes were not used. Accounts and passwords
were generated at runtime; no credentials or tokens are retained in this report.

## Results

- Alembic upgraded the empty database to `0009 (head)`.
- Registration followed by login succeeded; a new user's project list and workspace were empty.
- Created a project, set a synthetic Sarajevo calculation point, added Rectangle and
  Trapezoid roof surfaces, previewed panel fit and saved positive panel layouts.
- A real PVGIS request produced **5,570.43 kWh/year** and 12 saved monthly values.
  This is a QA example, not a production benchmark or an expected fixed value.
- The new simulation fingerprint matched the current configuration: `analyzed`.
- Renaming the project and changing its description preserved that status.
- Maximum-production optimization returned three candidates. Applying the second
  candidate succeeded and its saved fingerprint matched the resulting layouts.
- History contained two simulations. Reading the first simulation and comparing
  the two returned saved values without modifying current roof layouts.
- PDF and CSV report endpoints returned nonempty successful responses.
- Changing a roof's slope changed the status to `needs_recalculation`, consistently
  in project details and workspace counts. Historical annual production stayed unchanged.
- A separately registered user saw an empty workspace and received 404 for the
  first user's project, roof surfaces, history and individual saved simulation.
- Frontend returned HTTP 200 using the normal localhost Host header, and its API
  module targeted the isolated API on port 18000. A Docker-internal hostname was
  correctly rejected by Vite's Host protection; no allowed-host bypass was added.
- Full backend suite with `SOLARPLAN_TEST_DATABASE_URL` pointing at the isolated QA
  PostgreSQL server: **242 passed, zero skipped**, including PostgreSQL ownership,
  admin and migration compatibility checks. Only existing deprecation warnings remained.

## Scope and cleanup

The full application flow was exercised through HTTP API requests, with real PVGIS,
not mocked production results. This was not a manual browser click-through of every
form. No OpenAI generation was requested. Temporary scripts, generated accounts,
QA containers, anonymous frontend dependency volume and the tmpfs database were
removed after validation. No product code changes were needed.
