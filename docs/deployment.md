# Deployment Runbook (Coolify + PostgreSQL 18 + Valkey)

## 1. Topology Overview

Production runs as a hardened three-service Docker Compose stack (`docker-compose.yml`) managed by Coolify:

1. **`migrate`** (`Dockerfile.worker`, `restart: "no"`): runs `bun --conditions react-server scripts/migrate.ts && bun scripts/seed-production.ts` to apply checksummed migrations and idempotently seed plans, roles, permissions, and the 35 block definitions.
2. **`web`** (`Dockerfile`): the standalone Next.js 16 server on Bun `1.4.4`, running as `USER bun` with `read_only: true`, `tmpfs: [/tmp]`, `cap_drop: [ALL]`, and `no-new-privileges:true`. It publishes no host port; it is reachable only through the `caddy_ingress_network: coolify` label, and its health check probes `/api/health`.
3. **`worker`** (`Dockerfile.worker`): the `pg-boss` loop in `scripts/worker.ts`. It registers a handler for each queue, installs the cron schedules, and writes `worker_heartbeats` every 15 seconds; the container health check runs `bun scripts/worker-healthcheck.ts` and fails when that heartbeat is stale.

Both long-running services wait for `migrate` to complete (`service_completed_successfully`).

Queues and schedules:

| Queue                      | Cadence          |
| -------------------------- | ---------------- |
| `page.scheduled-publish`   | every minute     |
| `page.scheduled-unpublish` | every minute     |
| `domain.verify`            | every 15 minutes |
| `privacy.erasure`          | daily 02:00      |
| `media.orphan-sweep`       | daily 02:30      |
| `sweeper.daily`            | daily 03:00      |

## 2. Required Secrets & Environment Variables

Generate cryptographic keys before the first deployment:

```sh
bun run db:seed:keys
```

Copy `.env.production.example` into Coolify's environment configuration and supply:

- `DATABASE_URL` - PostgreSQL 18 connection string for an application role with `NOSUPERUSER NOBYPASSRLS` so forced Row-Level Security applies unconditionally.
- `REDIS_URL` - dedicated Valkey instance URL (`redis://` or `rediss://`).
- `BETTER_AUTH_URL`, `PRIMARY_DOMAIN`, `PLATFORM_DOMAIN`, and a non-default `ADMIN_PATH` (for example `/ops-console-9f4c`).
- The five 64-hex keys (`SETTINGS_ENCRYPTION_KEY`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `GUEST_LOOKUP_KEY`, `GUEST_CONTACT_KEY`, `BACKUP_ENCRYPTION_KEY`), `BETTER_AUTH_SECRET`, and `INTERNAL_TLS_CHECK_TOKEN`.
- SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`), both Cloudflare R2 credential pairs (upload and backup), and the Stripe keys.

Compose fails fast when `DATABASE_URL`, `REDIS_URL`, `SETTINGS_ENCRYPTION_KEY`, or `BACKUP_ENCRYPTION_KEY` is missing.

## 3. Custom Domain Verification

A connected hostname stays `pending` until its DNS TXT record exists:

```text
_spb-verify.<hostname>  TXT  <verificationToken copied from site_domains>
```

`verifyDomainAction` performs the lookup synchronously, and the `domain.verify` queue retries every pending, verifying, or failed domain every 15 minutes. Only then does the row become `active` (certificate state `pending`), and only active, non-removed domains pass `GET /api/internal/tls-check`.

## 4. Backup Restoration & GDPR Erasure Replay

Encrypted snapshots use the `bak1:<iv>:<tag>:<body>` envelope under `BACKUP_ENCRYPTION_KEY`:

```sh
bun scripts/decrypt-backup.ts /path/to/snapshot.enc > snapshot.sql
```

Restore and replay the erasure log in one step so erased guest contacts cannot resurrect:

```sh
bun run db:restore --file /path/to/snapshot.enc
bun run db:restore --file /path/to/snapshot.sql --plain
```

The CLI decrypts unless `--plain`, applies the dump with `psql`, then replays `erasure_logs`. `--skip-erasure-replay` is only for staging data that never held guest contacts.
