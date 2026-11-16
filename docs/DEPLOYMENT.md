# Production deployment

This is a separate production stack, not an override of development Compose.
The deployment target is Linux with Docker Compose v2 and systemd, at `/opt/solarplan`.
A real domain/server and off-site repository still need to be supplied by the operator.
Do not publish a development Vite server or development database alongside this stack.

## Prepare on the server

1. Point the chosen domain's DNS at the server. Permit inbound TCP 80/443 (and UDP
   443 if HTTP/3 is wanted), retaining your existing SSH administration access.
   Do not open 5432, 8000 or 5173. Check cloud rules as well as host firewall rules.
2. Copy `.env.production.example` to `.env.production`; replace the domain and ACME
   contact email. Do not use example domains in a real deployment. The frontend and
   API share one origin. Exact HTTPS CORS and allowed hosts are derived from that domain.
3. Run `sudo python3 deploy/init_secrets.py` on Linux. It refuses to overwrite keys,
   creates random independent DB/JWT/Restic secrets and gives backend secret files
   to container UID 10001. Keep `.secrets` mode 0700 and files 0600; protect these files
   and escrow the Restic password separately from the backup repository. Windows ACLs
   require equivalent protection; do not rely on Windows chmod for Linux deployment.
4. Copy `deploy/backup.env.example` to `.backup.env`. Set a real off-site Restic
   repository (for example a dedicated S3 bucket) and scoped credentials. Protect this
   file with mode 0600. Use a password manager/host secret management for key custody.
   The QA local repository is NOT a production backup destination.

Use this command prefix in the repository root:

```sh
docker compose --env-file .env.production -f compose.production.yaml
```

The file names the project `solarplan-production`, keeping its volumes independent.
It requires production domain/email and the backup environment file, and mounts secrets
rather than embedding JWT/database passwords in Compose environment values.

## First start

```sh
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml up -d db migrate
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps backup 'restic init'
docker compose --env-file .env.production -f compose.production.yaml up -d
```

Initialize a new repository only once. For an existing repository, skip `restic init`
and verify it with `restic check`. Never overwrite an existing DB volume to fix a
configuration error. Before updating an existing installation, take a backup and
review migrations; no automatic rollback or destructive reset is performed here.

Caddy serves the static Vite build, redirects HTTP to HTTPS and automatically requests
and renews public certificates. Keep its persistent `/data` volume: it contains TLS keys
and ACME account state. Backend runs as UID 10001, without reload, on a read-only root
filesystem. Only Caddy's exact internal IP is trusted for forwarded headers. Database
and API have no published ports. The app DB role is not a superuser and cannot create
roles/databases; it owns the application schema for migrations. If subnet 172.29.45.0/28
conflicts with the host, change proxy subnet/IP/range AND `--forwarded-allow-ips` together.

Only production disables Swagger/OpenAPI and adds strict Host validation. CSP permits
self-hosted scripts, inline styles needed by charts/maps and HTTPS map images. Development
remains usable. Optional OpenAI is disabled in this stack until an explicit backend-only
secret integration is configured; never pass an API key as a VITE build variable.

## Verify actual public deployment

Check HTTP redirects, trusted certificate/domain/chain, response headers, frontend routes,
API health and rejection of anonymous private requests. Check `docker compose ... ps`:
only web should publish ports. Confirm DB role privileges and run two-user ownership QA.
Certificate issuance/renewal, public DNS/firewall and actual off-site durability cannot
be proven by the local QA certificate. Verify them on the chosen server before go-live.

## Backup policy and monitoring

The backup service runs immediately, then every 24 hours. It uses pg_dump custom format,
Restic authenticated encryption, repository checks and retention of 7 daily, 4 weekly and
6 monthly snapshots. It fails if the configured repository is unavailable; it never
silently initializes a different repository. Plain dumps live only in a private tmpfs
and are removed on exit. The service exposes a healthcheck for successful backup age
(<25 hours). Monitor unhealthy/restarting containers and alert on backup failures; Docker
health status alone does not deliver alerts or restart an unhealthy container.

Target RPO: 24 hours (subject to successful monitored uploads). RTO must be measured
with actual production data and network throughput; no fixed recovery time is promised.
Keep restricted off-site credentials, Restic keys and DB/JWT secret custody separately.
Retention pruning is intentional; require a successful restore drill before changing it.
The application role is provisioned by init-db.sh; pg_dump does not include cluster roles.

## Weekly isolated restore drill

```sh
sudo cp deploy/systemd/solarplan-restore.service deploy/systemd/solarplan-restore.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now solarplan-restore.timer
sudo systemctl start solarplan-restore.service
journalctl -u solarplan-restore.service
```

The timer runs Sundays, persistent after downtime. The script creates a separate tmpfs
`drill-db`, verifies all repository data, restores the newest tagged backup, checks migration
revision and application row counts, and removes only that disposable service. It never
restores into `db`. Monitor failed systemd units and the timer on the actual host.
Do not run concurrent drills. For disaster recovery, stop application writes, provision
an isolated replacement stack and DB role using escrowed/new secrets, restore and verify
there, then deliberately switch traffic. Never test a restore by overwriting a live DB.

## Key rotation

`init_secrets.py` is initialization, not rotation. Rotate DB passwords through ALTER ROLE
and the matching file together during a planned window. Rotate JWT keys deliberately:
existing tokens are invalidated. Restic key changes require Restic key management and
verified access using the new key before retiring the old one. Do not delete key files
or change passwords independently of their dependent services.

## Local validation completed

- Production images for backend, static frontend/Caddy and backup built successfully.
- Clean production migrations and API startup succeeded with the restricted DB role.
- HTTPS tested with a trusted local QA CA and correct hostname (no TLS bypass).
- HTTP redirect, HSTS/CSP, frontend SPA route, API health, anonymous 401 and disabled
  API docs checked through the proxy. Registration/login/project creation passed.
- Real encrypted Restic backup, repository data verification, retention and restore into
  drill-db succeeded, restoring revision 0009 and a synthetic project.
- Secrets and volumes used for QA were isolated from the existing development database.
- Complete backend suite: 254 passed, zero skipped; Ruff passed.
- Public certificate issuance and remote repository activation remain target-host steps.

References: https://caddyserver.com/docs/automatic-https and
https://restic.readthedocs.io/en/stable/ (HTTPS renewal and encrypted backup operations).
