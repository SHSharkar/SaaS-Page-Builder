# Deployment Runbook (Coolify + PostgreSQL 18 + Valkey)

## 1. Topology Overview

Production runs as a hardened three-service Docker Compose stack (`docker-compose.yml`) managed by Coolify:

1. **`migrate`** (`Dockerfile.worker`, `restart: "no"`): Executes `bun --conditions react-server scripts/migrate.ts && bun scripts/seed-production.ts` to apply checksummed SQL migrations and idempotently seed plans, roles, permissions, and the 35 block definitions.
2. **`web`** (`Dockerfile`, `depends_on: migrate (service_completed_successfully)`): Runs the standalone Next.js 16 server on Bun `1.4.4` (`USER bun`, `read_only: true`, `cap_drop: ["ALL"]`, `no-new-privileges:true`) with `/api/health` liveness and `/api/health/ready` readiness probes.
3. **`worker`** (`Dockerfile.worker`, `depends_on: migrate (service_completed_successfully)`): Runs the `pg-boss` worker loop (`scripts/worker.ts`), recording liveness heartbeats in `worker_heartbeats` and executing durable background jobs (`sweeper.daily`, `domain.verify`, `site.import`, `media.derivatives`, `account.export`, `email.transactional`, `stripe.webhook`, `tls.renew-probe`).

## 2. Required Secrets & Environment Variables

Generate cryptographic keys before first deployment:

```sh
bun run db:seed:keys
```

Copy `.env.production.example` into Coolify's environment configuration and supply:

- `DATABASE_URL` - PostgreSQL 18 connection string using an application role with `NOSUPERUSER NOBYPASSRLS` so forced Row-Level Security policies apply unconditionally.
- `REDIS_URL` - Dedicated Valkey instance URL (`redis://` or `rediss://`).
- `APP_URL`, `SHORT_LINK_HOST`, and a non-default `ADMIN_PATH` (e.g., `/ops-console-9f4c`).
- All six 32-byte encryption/HMAC keys plus `BETTER_AUTH_SECRET` and `INTERNAL_TLS_CHECK_TOKEN`.
- Cloudflare R2 (`R2_*`), Resend (`RESEND_*`), and Stripe (`STRIPE_*`) credentials as applicable.

## 3. Backup Restoration & GDPR Erasure Replay

Whenever restoring a PostgreSQL backup in staging or production, immediately replay the immutable erasure log before re-enabling traffic so erased guest contact records cannot resurrect:

```sh
bun run db:restore
```

Encrypted off-site snapshots produced with `BACKUP_ENCRYPTION_KEY` can be decrypted offline using:

```sh
bun scripts/decrypt-backup.ts /path/to/snapshot.enc > snapshot.sql
```
