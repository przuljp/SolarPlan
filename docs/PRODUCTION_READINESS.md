# Production readiness review — 12 November 2026

> Remediation implemented after this audit: standalone production Compose, fail-closed
> settings, Caddy HTTPS/static frontend, private DB/API networks, file secrets and
> encrypted scheduled backup/isolated weekly restore tooling. See `DEPLOYMENT.md` for
> validated local results and the remaining server/domain/off-site activation steps.
> The findings below describe the original development setup, not the new production stack.


Scope: repository and local runtime configuration; no deployed domain, certificate,
cloud firewall or off-site backup account was supplied. No production settings,
credentials, user records or application logic were changed during this review.

## Deployment blockers / required configuration

1. Local environment is development. Its JWT secret and database password match
   the example defaults. JWT length alone is not a security check: the known example
   is already longer than 32 characters. Configure independently generated production
   secrets and a restricted database role. Never reuse local defaults.
2. `Settings(environment='production', _env_file=None)` accepts the default JWT
   secret and default database URL. There is no fail-closed production validator.
   Add production validation before deployment; changing the JWT key invalidates
   previously issued tokens and should be deliberate.
3. CORS currently allows localhost, without a wildcard. Preflight tests confirmed
   the allowed origin receives permission and an untrusted origin does not. Set the
   exact production HTTPS frontend origin (scheme, hostname and port). CORS is not
   authorization and does not restrict non-browser clients.
4. No production reverse-proxy/TLS configuration is present. Development Compose
   publishes DB/API/frontend ports on host interfaces, runs the backend with reload
   and serves the frontend with Vite dev server. Prepare a production deployment:
   static frontend build, HTTPS ingress, certificate renewal, private database and
   API networking, trusted proxy forwarding and no development reload server.
   Public-domain TLS, redirect, certificate renewal and firewall checks remain unverified.
5. No scheduled/off-site/encrypted backup policy or restore runbook was found.
   Define retention, access permissions, encryption, storage destination, RPO/RTO and
   a recurring restore drill. A Docker data volume alone is not a backup.

## Secret handling checks

- `.env` is ignored by Git and not tracked; `.env.example` contains development examples.
- Current tracked text files had no matches for the checked OpenAI-key and PEM private-key
  patterns. This is a limited pattern check, not a complete historical secret audit.
- The local OpenAI key is configured, but its value was never printed or transmitted.
- The frontend stores access tokens in sessionStorage; API secrets are server-side.
  Token storage does not replace XSS protection. Review CSP/headers at the production proxy.
- Backend/frontend Docker ignore files do not explicitly exclude `.env*`; add exclusions
  before production builds so future per-directory secret files cannot enter image layers.

## Private-data checks

- Requests without a token to `/projects`, `/projects/workspace`, `/users/me` and
  `/admin/dashboard` all returned 401 in the actual ASGI app.
- Auth validates token algorithm/issuer/audience/expiry and rejects inactive users.
- Owner filtering exists in project/workspace queries and saved simulation/report reads.
- The preceding clean-database QA verified a second user receives 404 for another
  user's project, surfaces, history and simulation. All 242 backend tests passed in
  that isolated PostgreSQL run, including admin/ownership integration tests.

## Actual backup/restore drill

A separate Compose project `solarplan-security-qa` used PostgreSQL 17 with tmpfs,
no published ports, current Alembic schema and synthetic registered user/project data.

1. Migrated `audit_source` and created synthetic application records through API calls.
2. Created a custom-format dump using `pg_dump -Fc`.
3. Restored into the separate `audit_restored` database using `pg_restore
   --exit-on-error --no-owner --no-acl` (clean restore inside disposable QA only).
4. Compared row counts and SHA-256 digests of canonically sorted JSON rows for
   every public table. **All 12 tables matched**, including nonempty users/projects.

This validates schema/data restoration, not off-site storage, encryption, role/grant
recovery, throughput at production scale or recovery-time objectives. Production roles
must be recreated separately or included in a protected globals backup. No real user
backup was copied. Temporary scripts, dump, containers and tmpfs data were removed.

## Primary references

- https://fastapi.tiangolo.com/tutorial/cors/
- https://fastapi.tiangolo.com/deployment/https/
- https://www.postgresql.org/docs/17/app-pgrestore.html
- https://www.postgresql.org/docs/current/backup-dump.htm
