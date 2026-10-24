# SaaS Page Builder

Multi-tenant SaaS visual page builder with forced PostgreSQL 18 Row-Level Security, immutable page snapshots, 35 typed content blocks, custom domain verification, short-link & QR protection, GDPR contact encryption, and a 24-step verification gate.

## Stack & Runtime Baseline

- **Runtime & Package Manager**: Bun `1.4.4` (`bun --bun`, `ignoreScripts: true`, audited `trustedDependencies`)
- **Framework**: Next.js 16 App Router (`output: "standalone"`, React 19, strict TypeScript)
- **Database & Queue**: PostgreSQL 18 + Drizzle ORM + `pg-boss` durable background jobs + `LISTEN` / `NOTIFY` SSE invalidation
- **Cache & Rate Limiting**: Valkey (`ioredis`) - strict single-authority cache and sliding-window rate limiter with zero in-memory fallbacks
- **Authentication**: Better Auth session cookies, Argon2id/scrypt credentials, TOTP two-factor, workspace capability matrix, and configurable stealth platform console (`ADMIN_PATH`)
- **UI & Accessibility**: Tailwind CSS 4 semantic tokens, wrapped UI primitives (`components/ui/*`), full `en-GB` / `en-US` message catalog parity, WCAG 2.1 AA contrast verification

## Surface Topology

- `app/(public)/` - Marketing pages, authentication flows, GDPR self-service (`/my-data`), short-link crawler shield (`/go/[code]`, `/scan/[segment]`), and published site renderer (`/s/[siteSlug]/[[...path]]` + custom host routing in `proxy.ts`)
- `app/(app)/` - Signed-in multi-tenant workspace (`dashboard`, `sites`, visual `editor`, `templates`, `domains`, `media`, `imports`, `analytics`, `team`, `export`, `settings`)
- `app/admin/` - Platform superadmin & support console mounted dynamically at `ADMIN_PATH` (`proxy.ts` returns `404` for direct `/admin/*` requests)
- `app/server/` - Server-only domain subsystems (`withAccount`, `withPlatform`, `capabilities`, `crypto`, `privacy`, `sites`, `pages`, `domains`, `media`, `imports`, `templates`, `short-links`, `jobs`, `sweeper`)
- `lib/` - Pure client-safe utilities, formatters, enums, and the 35-block registry

## Quick Start

```sh
./scripts/local.sh status
./scripts/local.sh migrate
./scripts/local.sh seed
bun run verify
bun run dev
```

## Verification Gate

Run the full tiered verification gate locally before pushing:

```sh
bun run verify
```

Individual checks can be run via `bun run verify:rls`, `bun run verify:authz`, `bun run verify:capabilities`, `bun run verify:contrast`, `bun run verify:client-boundary`, `bun run test:coverage`, and `bun run preflight`.
