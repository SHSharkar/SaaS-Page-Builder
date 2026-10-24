# SaaS Page Builder

Multi-tenant SaaS visual page builder with forced PostgreSQL 18 Row-Level Security, immutable page versions, 35 typed content blocks, DNS-verified custom domains, short-link and QR protection, GDPR contact encryption, and a 24-check verification gate.

## Stack & Runtime Baseline

- **Runtime & Package Manager**: Bun `1.4.4` (`bun --bun`, audited `trustedDependencies`)
- **Framework**: Next.js 16 App Router (`output: "standalone"`, React 19, strict TypeScript)
- **Database & Queue**: PostgreSQL 18 + Drizzle ORM + `pg-boss` durable jobs + `LISTEN`/`NOTIFY` SSE invalidation
- **Cache & Rate Limiting**: Valkey (`ioredis`) as the single cache authority, plus the published-page cache index
- **Authentication**: Better Auth session cookies, Argon2id credentials, TOTP two-factor, workspace capability matrix, and a stealth platform console (`ADMIN_PATH`)
- **UI & Accessibility**: Tailwind CSS 4 semantic tokens, wrapped UI primitives (`components/ui/*`), full `en-GB`/`en-US` catalog parity (233 keys), WCAG 2.1 AA contrast verification

## Surface Topology

- `app/(public)/` - marketing, authentication, GDPR self-service (`/my-data`), short-link crawler shield (`/go/[code]`, `/scan/[segment]`), and the published-site renderer (`/s/[siteSlug]/[[...path]]` plus custom-host rewrites in `proxy.ts`)
- `app/(app)/` - signed-in workspace (`dashboard`, `sites`, `sites/[siteId]/*` including the editor, `templates`, `domains`, `media`, `imports`, `analytics`, `team`, `export`, `settings`)
- `app/admin/` - platform operator console mounted at `ADMIN_PATH` (`proxy.ts` returns `404` for direct `/admin/*` requests)
- `app/server/` - server-only subsystems (`withAccount`, `withPlatform`, `capabilities`, `crypto`, `privacy`, `sites`, `pages`, `domains`, `media`, `imports`, `templates`, `short-links`, `jobs`, `sweeper`)
- `lib/` - client-safe utilities, formatters, enums, request-header constants, and the 35-block registry

## Quick Start

```sh
./scripts/local.sh status
./scripts/local.sh migrate
./scripts/local.sh seed
bun run dev
```

`./scripts/local.sh` also provides `dev` (Next.js + worker), `verify`, and `doctor` for local tool checks.

## Verification Gate

`scripts/verify-plan.ts` owns the 24-check catalogue and tier planning, `scripts/verify-gate.ts` executes it, and `scripts/verify-log.ts` reads the run journal.

```sh
bun run verify          # full tier, the same plan the pre-push hook runs
bun run verify:fast     # docs-only tier
bun run verify:code     # source tier
bun run verify:schema   # source plus schema/RLS tier
bun run verify:log      # recent gate runs from .verify-logs/history.jsonl
```

Individual checks are available as `bun run verify:rls`, `verify:authz`, `verify:capabilities`, `verify:contrast`, `verify:client-boundary`, `verify:queue-policies`, `bun run test:coverage`, and `bun run preflight`.

## Background Jobs

`bun run worker` starts `scripts/worker.ts`, which registers a handler for every queue declared in `lib/enums/job-kind.ts` and schedules each cron entry: scheduled publish/unpublish (per minute), domain re-verification (15 minutes), erasure replay, media sweep, and the daily keep-window sweeper. `scripts/worker-healthcheck.ts` answers the container health check from `worker_heartbeats`.
