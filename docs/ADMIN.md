# SolarPlan administration

## First administrator

1. Start the existing local stack with `docker compose up -d --build`. The backend applies
   migration `0009` automatically. Without Docker, run `alembic upgrade head` from `backend`
   with the intended database configuration.
2. Register the intended administrator through the normal registration form. It creates an
   active USER account, regardless of additional `role` or `is_active` fields in a request.
3. From a trusted terminal with access to the backend and its database, run:

   ```bash
   docker compose exec backend python -m app.admin_cli promote --email your-address@example.com
   ```

   Without Docker, activate the backend environment and run the same `python -m app.admin_cli`
   command from `backend`. The command only promotes an existing active account; it never
   creates a password or reactivates an account. No default administrator or credential is shipped.
4. Sign in again, or reload an existing session. The account opens `/admin`. Admin navigation
   contains Dashboard, Panel catalog, and Users. The brand link returns to `/admin`.

No administrator was assigned in the application's existing database during implementation.

## Authorization and account activity

- JWT format stays unchanged. Every protected request loads the user from the database;
  inactive accounts receive 401 even with a previously issued, valid token. Inactive accounts
  cannot sign in. Admin endpoints additionally require the current ADMIN role or return 403.
- Registration always assigns USER. There is no public API for assigning roles, impersonation,
  password inspection, or access to another user's private projects.
- Deactivation preserves projects and other data. Self-deactivation and deactivation of the
  last active administrator return 409. Transaction-scoped PostgreSQL advisory locking and
  rechecking the acting administrator serialize concurrent account changes and CLI promotions.
- User search is a case-insensitive, literal email substring match. Pagination uses `offset`
  and `limit` (default 20, maximum 100). User responses include project counts and exclude hashes.

## Panel consistency and migration

Migration `0009` adds `users.role` (USER by default, constrained to USER/ADMIN),
`users.is_active`, `solar_panels.is_active` (both true by default), and non-null JSON
`panel_layouts.panel_snapshot`. Existing layout snapshots are backfilled from their linked
catalog records. No records are deleted and no database reset is required. Downgrading removes
these new columns, including role/activity state and layout snapshots; it retains core records.

New layouts and optimizer candidates only use active catalog models. Inactive models remain
readable through saved layouts and results; new/changed layouts using them are rejected.
Manual optimization of an inactive model gives a controlled validation error before PVGIS.

Saving a layout captures the panel specifications. Existing layouts keep that snapshot when
reopened or adjusted with the same model. Catalog updates apply to new layouts; an explicit
optimizer selection can replace a layout and capture the selected current specifications.
Production calculations continue using saved installed capacity and matching snapshot metadata.
Existing simulation snapshots, comparisons, reports, and AI evidence remain unchanged.

Panel deletion returns 409 for references in saved layouts, historical simulation snapshots,
or saved optimizer candidate/rejection snapshots, including when the original layout was removed.
The existing foreign key provides an additional deletion guard. Shared catalog locks serialize
selection/optimization against concurrent administrative changes. Duplicate model SKUs return 409.
Input validation covers required text, categories, positive dimensions/power, efficiency, finite
temperature coefficients in %/°C, HTTP(S) sources, and verification dates.

## New API endpoints

All paths below use the `/api/v1` prefix and require an active ADMIN account.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/admin/dashboard` | Total/active users, total projects, all panel models |
| GET | `/admin/users?email=&offset=0&limit=20` | Search accounts with project counts |
| PATCH | `/admin/users/{user_id}/activity` | Set `is_active` |
| GET | `/admin/panels` | Read active and inactive models |
| POST | `/admin/panels` | Create an active model |
| PUT | `/admin/panels/{panel_id}` | Update all supported specifications |
| PATCH | `/admin/panels/{panel_id}/activity` | Set `is_active` |
| DELETE | `/admin/panels/{panel_id}` | Delete an unused model |

The React routes are `/admin`, `/admin/panels`, and `/admin/users`. They reuse the existing
workspace shell, design tokens, query client, and HTTP client. Standard users see no admin links.
Forms and lists include loading, empty, error, retry, and success states. Important updates,
activation/deactivation, and deletion require browser confirmation. Tables scroll locally on
small screens; forms stack vertically and navigation adapts to mobile widths.

## Verification

Backend unit/API authorization tests run with the existing `pytest` command. PostgreSQL tests
are opt-in and require a disposable test server whose user can create databases and schemas:

```powershell
$env:SOLARPLAN_TEST_DATABASE_URL = 'postgresql+asyncpg://TEST_USER@127.0.0.1:55439/postgres'
python -m pytest tests -q
```

Tests create unique schemas and a temporary migration database and clean up their own data.
They cover the full admin/user API flow, existing JWT deactivation, private project isolation,
panel snapshots, active catalog selection, historical references, actual aggregate counts,
concurrent admin deactivation, and upgrade/downgrade/upgrade from `0008` with existing records.
Without the variable, database-dependent tests explicitly skip. Frontend: `npm test` and
`npm run build`. Visual QA used synthetic data on desktop and at 390px mobile width.

Verified on 12 November 2026: **205/205 backend tests** (including all PostgreSQL tests),
**38/38 frontend tests**, production build, and Ruff passed. Existing build warning: main
JavaScript chunk exceeds 500 kB. The migration test also reports Alembic's existing
`path_separator` configuration deprecation warning.

No deployment, email verification, password recovery, account deletion, or global settings
management is included. The application's original local database still needs its normal
startup/migration before the new feature can be used.

## Files

- New backend: `app/admin_cli.py`, `app/{repositories,routers,schemas,services}/admin*.py`,
  `alembic/versions/0009_admin_roles_and_panel_snapshots.py`,
  `tests/test_admin.py`, `tests/test_admin_migration.py`.
- Updated backend: `app/dependencies/auth.py`, `app/main.py`,
  `app/models/{user,solar_panel,panel_layout}.py`,
  `app/repositories/{user_repository,solar_panel_repository}.py`,
  `app/schemas/{user,solar_panel}.py`,
  `app/services/{auth_service,panel_layout_service,configuration_optimization_service,energy_simulation_service}.py`.
- New frontend: `src/components/AdminRoute.tsx`, `src/pages/AdminPages.tsx`,
  `src/pages/AdminPages.test.tsx`.
- Updated frontend: `src/App.tsx`, `src/components/AppShell.tsx`, `src/lib/api.ts`,
  `src/types/api.ts`, `src/styles.css`,
  `src/pages/{AuthPage,PanelLayoutPage,PanelSelectionPage}.tsx`.
- Documentation: `README.md`, `AGENTS.md`, `PRODUCT.md`, `docs/DEVELOPMENT_CONTEXT.md`,
  and this file.
