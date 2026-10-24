# SaaS Page Builder - Project Foundation Report

## 1. Executive Summary

This report documents the production foundation of **SaaS Page Builder** (`saas-page-builder`), engineered on **Bun `1.4.4`**, **Next.js 16 App Router (`standalone`)**, **React 19**, **Tailwind CSS 4**, **PostgreSQL 18 (Drizzle ORM + forced RLS + `pg-boss`)**, and **Valkey (`ioredis`)**.

Every layer enforces defense-in-depth invariants statically in CI/pre-push (`scripts/verify-plan.ts`) and at runtime (`scripts/preflight.ts`, `withAccount`, `proxy.ts`, and `app/server/auth/guards.ts`).

---

## 2. Directory & Boundary Architecture

| Layer | Path | Responsibility & Enforced Boundary |
| --- | --- | --- |
| Public Surface | `app/(public)/` | Marketing, auth forms, `/my-data`, `/go/[code]`, `/scan/[segment]`, `/s/[siteSlug]/[[...path]]` |
| Tenant Workspace | `app/(app)/` | Authenticated multi-site workspace guarded by `requireAccountPageCapability` |
| Stealth Admin | `app/admin/` | Platform operator console reachable only via `ADMIN_PATH` rewrite in `proxy.ts` |
| API & Webhooks | `app/api/`, `app/webhooks/` | Health probes (`/api/health`, `/api/health/ready`), Better Auth, OG SVG, R2 file stream, SSE realtime, Stripe & TLS webhooks |
| Server Subsystems | `app/server/` | `import "server-only"` modules (`db`, `redis`, `auth`, `capabilities`, `crypto`, `privacy`, `accounts`, `sites`, `pages`, `globals`, `domains`, `media`, `imports`, `templates`, `short-links`, `jobs`, `sweeper`, `admin`) |
| Pure Shared Library | `lib/` | Client-safe enums, formatters (`money.ts`, `dates.ts`, `byte-size.ts`), identifiers, crawler detector, and 35-block `registry/` |
| Wrapped UI Primitives | `components/ui/` | Sole location permitted to render raw HTML interactive/layout elements |
| App Shells & Studio | `components/app-shell/`, `components/blocks/`, `components/editor/` | Composed workspace/public/admin shells, document renderer, and visual block studio |
| Localization | `messages/` | `en-GB.json` & `en-US.json` (100% key and placeholder parity) + 5 guest overlays |
| Lifecycle & Gate | `scripts/` | Migrations, seeds, `pg-boss` worker, preflight, backup/erasure tools, and 16 `verify-*.ts` checks |

Boundary rules are enforced simultaneously by **ESLint (`eslint.config.mjs`)**, **Dependency Cruiser (`.dependency-cruiser.mjs`)**, and **`scripts/verify-client-boundary.ts`**.

---

## 3. Database Schema & Forced Row-Level Security

### 3.1 Platform Tables (`16`)

`users`, `sessions`, `auth_accounts`, `verifications`, `two_factors`, `plans`, `accounts`, `roles`, `permissions`, `role_permissions`, `platform_settings`, `component_definitions`, `platform_templates`, `erasure_logs`, `webhook_events`, `worker_heartbeats`.

### 3.2 Tenant-Scoped Tables (`16` - Forced RLS)

`account_memberships`, `account_invitations`, `subscriptions`, `sites`, `site_globals`, `pages`, `page_snapshots`, `page_revisions`, `site_domains`, `media_assets`, `media_variants`, `site_import_jobs`, `account_templates`, `short_links`, `audit_events`, `guest_contacts`.

Every tenant-scoped table enforces:

1. `account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`
2. Composite `(id, account_id)` unique constraint so child tables bind `(parent_id, account_id)` via composite foreign keys - making cross-account foreign-key attachment impossible at the PostgreSQL constraint layer.
3. `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` with policy `account_isolation`:
   ```sql
   USING (
     current_setting('app.platform_bypass', TRUE) = 'on'
     OR (
       current_setting('app.current_account_id', TRUE) <> ''
       AND account_id = current_setting('app.current_account_id', TRUE)::uuid
     )
   )
   ```
4. Transaction-scoped GUCs (`SET LOCAL app.current_account_id` in `withAccount` and `SET LOCAL app.platform_bypass = 'on'` in `withPlatform`), plus narrow `SECURITY DEFINER` lookup functions (`spb_lookup_published_domain`, `spb_lookup_published_site`, `spb_resolve_short_link`) for unauthenticated public rendering.

---

## 4. Security, Privacy & Resilience Controls

- **Stealth Admin & CSP Nonce (`proxy.ts`)**: Generates per-request CSP nonces, sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy`, returns `404` on `/admin/*`, rewrites `ADMIN_PATH` to `/admin`, and routes verified custom domains directly to `/s/{siteSlug}`.
- **Cryptographic Separation (`app/server/crypto`)**: Distinct 32-byte keys for `SETTINGS_ENCRYPTION_KEY`, `GUEST_CONTACT_KEY`, `GUEST_LOOKUP_KEY`, `BACKUP_ENCRYPTION_KEY`, and `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`. Privacy leak isolation is enforced by `app/server/privacy/leak.test.ts`.
- **Circuit Breakers & SSRF Guard**: External calls wrap in `CircuitBreaker` (`app/server/breaker.ts`), and user-supplied URLs pass DNS + IP range inspection (`app/server/network/outbound-url.ts`).
- **Durable Jobs (`pg-boss`)**: All 8 background queues (`JOB_KINDS`) configure explicit `retryLimit`, `retryDelay`, `retryBackoff: true`, and `expireInSeconds` (`verify:queue-policies`).

---

## 5. Verification Gate (`scripts/verify-plan.ts`)

Running `bun run verify` executes all 24 gate steps and writes structured telemetry to `.verify-logs/latest.json`:

1. `format` - Prettier formatting check across all tracked files
2. `wording` - Blocks legacy brand strings and embedded-DB identifiers (`scripts/verify-wording.ts`)
3. `shell` - Validates `.husky/*` and `scripts/*.sh` with `shellcheck -s sh` and `shfmt -d -i 2 -ci` (`scripts/verify-shell.ts`)
4. `naming` - Enforces kebab-case file naming conventions (`scripts/verify-naming.ts`)
5. `typecheck` - Strict TypeScript compiler check (`tsc --noEmit`)
6. `lint` - ESLint (`--max-warnings 0`) including `house/no-source-comments`, `house/no-raw-tailwind-palette`, `no-console`, `complexity <= 15`, wrapped UI primitives, and `react/jsx-no-literals`
7. `lint-css` - Stylelint check on `app/globals.css`
8. `contrast` - WCAG 2.1 AA contrast ratio verification across `:root` and `.dark` token pairs (`scripts/verify-color-contrast.ts`)
9. `client-boundary` - Verifies no client/shared file imports `app/server/**` (`scripts/verify-client-boundary.ts`)
10. `deps` - Dependency Cruiser graph validation (`.dependency-cruiser.mjs`)
11. `authz` - Verifies every `"use server"` file and private API route invokes capability/session guards (`scripts/verify-authz.ts`)
12. `capabilities` - Verifies every capability is well-formed and mapped to roles (`scripts/verify-capabilities.ts`)
13. `roles` - Verifies role hierarchy invariants (`owner` superset of `admin` -> `editor` -> `viewer`) (`scripts/verify-roles.ts`)
14. `tenant-delete` - Verifies `accounts` cascade delete reaches all 16 tenant tables (`scripts/verify-tenant-delete.ts`)
15. `queue-policies` - Verifies explicit retry/backoff/expiration policies for every `JOB_KINDS` queue (`scripts/verify-queue-policies.ts`)
16. `message-catalog` - Verifies `en-GB` / `en-US` key + placeholder parity and 100% `t("...")` call coverage (`scripts/verify-message-catalog.ts`)
17. `migrations` - Verifies Drizzle journal + SHA-256 SQL checksum integrity (`scripts/verify-migrations.ts`)
18. `migration-safety` - Blocks unguarded destructive DDL in SQL migrations (`scripts/verify-migration-safety.ts`)
19. `rls` - Verifies forced RLS, composite tenant FKs, and `bare-database-allowlist.json` (`scripts/verify-rls.ts`)
20. `unused` - Knip dead-export / unused-dependency analysis (`knip.json`)
21. `audit` - `bun audit` zero-vulnerability check (`scripts/verify-audit.ts`)
22. `licenses` - Production dependency OSI/permissive license verification (`scripts/verify-licenses.ts`)
23. `test-coverage` - Vitest unit + live PostgreSQL/Valkey integration suite (`>= 80%` lines, statements, functions, branches)
24. `preflight` - Live PostgreSQL 18 forced-RLS catalog inspection + Valkey readiness (`scripts/preflight.ts`)

---

## 6. Hardened Container & Coolify Topology

- **`Dockerfile`**: 3-stage `oven/bun:1.4.4-slim` build producing Next.js standalone runner executing as `USER bun` with built-in `/api/health` `HEALTHCHECK`.
- **`Dockerfile.worker`**: Dedicated `oven/bun:1.4.4-slim` non-root worker & migration image (`USER bun`).
- **`docker-compose.yml`**: Orchestrates `migrate` (`restart: "no"`), `web`, and `worker` with `service_completed_successfully` ordering, `read_only: true`, `tmpfs: ["/tmp"]`, `cap_drop: ["ALL"]`, and `security_opt: ["no-new-privileges:true"]`.
