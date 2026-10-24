# SaaS Page Builder - Project Foundation Report

- Scope: development lifecycle, tooling, configuration, quality gates, containers, and deployment wiring.
- Date: 24 October 2026. Revised after the architecture audit in `docs/audit-2026-10-24.md`.

## 1. Executive Summary

Single-repository Next.js 16 application on Bun `1.4.4` with three services: a standalone web server, a `pg-boss` worker, and a one-shot migration job. PostgreSQL 18 (Drizzle ORM, forced RLS) is the only relational store and Valkey the only cache. Quality enforcement is local: four Husky hooks, a 24-check gate, and a Vitest suite with an 80% coverage floor. There is no `.github` directory and no hosted pipeline.

## 2. Repository Layout

| Layer | Path | Responsibility |
| --- | --- | --- |
| Public surface | `app/(public)/` | Marketing, auth, `/my-data`, `/go/[code]`, `/scan/[segment]`, `/s/[siteSlug]/[[...path]]` |
| Workspace | `app/(app)/` | Signed-in multi-site workspace behind `requireAccountPageCapability` |
| Platform console | `app/admin/` | 16 operator areas, reachable only through the `ADMIN_PATH` rewrite |
| API & webhooks | `app/api/`, `app/webhooks/` | Health, auth, files, OG, realtime, TLS probe, Stripe and domain-TLS webhooks |
| Server subsystems | `app/server/` | `accounts`, `admin`, `audit`, `auth`, `capabilities`, `crypto`, `db`, `domains`, `email`, `env`, `globals`, `imports`, `jobs`, `lifecycle`, `logger`, `media`, `network`, `overview`, `pages`, `platform-config`, `privacy`, `public-site`, `realtime`, `redis`, `short-links`, `sites`, `storage`, `sweeper`, `team`, `templates`, `text`, `test-support`, `webhooks` |
| Shared library | `lib/` | Enums, documents, formatters, identifiers, crawler detection, request-header constants, `registry/` (35 blocks) |
| UI primitives | `components/ui/` | The only place raw HTML interactive elements may appear |
| Localization | `messages/` | `en-GB` + `en-US` (233 keys) and five guest overlays |
| Lifecycle & gate | `scripts/` | Migrations, seeds, worker, healthcheck, restore, and every `verify-*` check |

Boundary rules are enforced by ESLint, Dependency Cruiser, and `scripts/verify-client-boundary.ts` simultaneously.

## 3. Database

34 tables in `drizzle/0000_initial_schema.sql`; 16 tenant-scoped tables carry `account_id`, composite `(id, account_id)` uniqueness, composite tenant foreign keys, `ENABLE`/`FORCE ROW LEVEL SECURITY`, and the `account_isolation` policy bound to `current_setting('app.account_id')` and `current_setting('app.platform_bypass')`. `withAccount` sets both GUCs transaction-locally; `withPlatform` sets the bypass. Public reads go through SECURITY DEFINER functions (`resolve_public_page_snapshot`, `verify_active_tls_domain`, `resolve_short_link_by_hash`, `resolve_scan_share_site`, `superadmin_reveal_contact`). `scripts/lib/bare-database-allowlist.json` names the only modules allowed to import the bare client.

## 4. Verification Gate

### Components

- `scripts/verify-plan.ts` - the 24-step catalogue with `minTier` per step, `planGateSteps(tier)`, `describePlan(tier)`, and `changedFiles()` (merge-base against `origin/main` plus working tree and untracked files).
- `scripts/verify-tier.ts` - `classifyVerifyTier(changedFiles, trigger, forced)`. `VERIFY_TRIGGER=manual` or an empty change set forces `full`; `VERIFY_TIER` overrides.
- `scripts/verify-gate.ts` - executes the plan sequentially, writes `.verify-logs/latest.json`, appends a journal entry, and prints the recovery hint (`bun run verify:fix`) on failure.
- `scripts/verify-log.ts` - the journal reader (`bun run verify:log`, `--limit N`, `--all`) over `.verify-logs/history.jsonl`.

### Steps

format, wording, shell, naming, typecheck, lint, lint-css, contrast, client-boundary, deps, authz, capabilities, roles, tenant-delete, queue-policies, message-catalog, migrations, migration-safety, rls, unused, audit, licenses, test-coverage, preflight.

### Hooks

- `pre-commit`: `gitleaks protect --staged --redact` when gitleaks is installed, then `lint-staged`.
- `commit-msg`: Conventional Commits subject.
- `post-merge`: reinstalls the lockfile and applies migrations when those files change.
- `pre-push`: `exec bun scripts/verify-gate.ts`.

## 5. Testing

Vitest 5 with two projects (`node`, `dom`), a global setup that creates and migrates the test database, `maxWorkers: 4`, and V8 coverage at 80% for statements, branches, functions, and lines. Playwright holds a single marketing/auth journey spec with axe-core accessibility checks in light, dark, and narrow viewports; it is a separate command and not part of the gate.

The database-dependent suites (`subsystems`, `hardening`, `jobs`, `coverage-gaps`, `with-account`, `session`, `redis`) require PostgreSQL 18 and Valkey. `TEST_DATABASE_URL`/`TEST_REDIS_URL` override the defaults (`SPB_LOCAL_PG_*`, `SPB_LOCAL_VALKEY_*`). Forced RLS only applies to a role without `BYPASSRLS`, so the test role must not be a superuser.

## 6. Custom Verify Scripts

Each `verify-*.ts` returns a `CheckResult` through `scripts/lib/check.ts`:

`verify-migrations`, `verify-migration-safety`, `verify-rls` (forced RLS + bare-database allowlist), `verify-authz` (capability guards on actions, pages, and routes), `verify-capabilities`, `verify-roles`, `verify-naming`, `verify-tenant-delete`, `verify-queue-policies`, `verify-message-catalog`, `verify-color-contrast`, `verify-licenses`, `verify-audit`, `verify-wording`, `verify-shell`, `verify-client-boundary`, `preflight`.

`scripts/verify-shell.ts` now refuses to pass silently: it fails with install instructions when `shellcheck` or `shfmt` is missing and otherwise reports each tool's real output.

## 7. Database Tooling

`drizzle.config.ts` points drizzle-kit at `app/server/db/schema/index.ts` and outputs to `drizzle/`. `bun run db:migrate` applies migrations under the `react-server` condition. Checksums live in `drizzle/meta/_checksums.json` and are enforced by `verify:migrations`.

Backup tooling:

- `bun run db:restore --file <dump>` - decrypts (`bak1:` envelope, `BACKUP_ENCRYPTION_KEY`) unless `--plain`, applies the SQL through `psql`, then replays the erasure log so erased contacts stay erased. `--skip-erasure-replay` opts out.
- `bun run backup:decrypt` - offline envelope decryption.
- `bun run db:replay-erasure-log` - erasure replay without a restore.
- `bun run db:purge-keep-window` - keep-window purge on demand.

## 8. Local Development

`scripts/local.sh {status|migrate|seed|verify|dev}` plus `doctor`. `package.json` exposes `dev`, `dev:all`, `worker:dev`, and `stripe:listen`. `bunfig.toml` preloads `scripts/lib/server-only-stub.ts` and `scripts/lib/development-env-preload.ts`.

## 9. Environment and Secrets

`.env.example` lists key names; `.env.production.example` shows placeholder shapes. Required runtime keys are validated by `app/server/env.ts` (Zod) and `scripts/preflight.ts`: `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `PRIMARY_DOMAIN`, `PLATFORM_DOMAIN`, `ADMIN_PATH`, `SETTINGS_ENCRYPTION_KEY`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, `GUEST_LOOKUP_KEY`, `GUEST_CONTACT_KEY`, `BACKUP_ENCRYPTION_KEY`, `INTERNAL_TLS_CHECK_TOKEN`, SMTP settings, two R2 credential pairs, and Stripe keys. No secret enters a Docker build; the compose file fails fast on the three most critical values (`${VAR:?}`).

## 10. Containers

Both images build from `oven/bun:1.4.4-slim` and run as `USER bun`. `Dockerfile` is a multi-stage Next.js standalone build with an artifact assertion and a `/api/health` health check. `Dockerfile.worker` installs production dependencies, copies `app`, `lib`, `messages`, `drizzle`, and `scripts`, and runs `bun scripts/worker.ts`.

`docker-compose.yml` defines `migrate` (`restart: "no"`), `web` (expose-only on 3000 with the `caddy_ingress_network: coolify` label), and `worker` (heartbeat health check). A shared `x-hardening` anchor applies `read_only`, `tmpfs: [/tmp]`, `cap_drop: ALL`, `no-new-privileges`, and 16 MB × 4 json-file logging to all three services; memory and PID limits are explicit per service (web 1536 MB / 768 PIDs, worker 1024 MB / 768 PIDs, migrate 512 MB / 336 PIDs). `init: true` and stop grace periods apply to the two long-running services.

## 11. Deployment

One Coolify resource. Caddy terminates TLS outside the repository. PostgreSQL and Valkey are external. `docs/deployment.md` holds the procedure; `scripts/preflight.ts` runs inside the gate and before a deploy.

## 12. CI Posture

No hosted pipeline. `next.config.ts` sets `typescript.ignoreBuildErrors: true` on purpose (the type check is a gate step and the Turbopack cache keeps the image build short), and `next.config.test.ts` pins that choice.

## 13. AI Agent Tooling

`.claude/` and `.agents/` hold the same architecture skill (mirrored, byte-identical). `AGENTS.md`, `CLAUDE.md`, and `.specify/memory/constitution.md` are the rulebooks, with the constitution taking precedence.

## 14. Repository Hygiene

`.gitignore` covers dependencies, build output, coverage, env files (examples kept), dumps, `.verify-logs/`, and `sbom.cdx.json`. `.prettierignore` excludes generated directories. `bun run sbom` writes a CycloneDX file at the root.

## 15. Known Limits

- The Playwright suite is one spec, not a full journey matrix.
- `import.process` was removed from the queue catalogue: imports are analysed synchronously and applied through the review path, so a queue with no producer and no handler no longer exists. The same applies to `backup.snapshot`; backups are produced and restored by the `db:restore`/`backup:decrypt` CLIs.
- Media purge deletes database rows; object cleanup in R2 for retired assets is still manual.
- Self-service erasure is rate limited and audited but not yet gated behind an emailed confirmation link.
