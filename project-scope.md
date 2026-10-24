# SaaS Page Builder - Project Scope

- Scope: what the product is, how it is built, and how it runs, grounded in the repository as it stands on 24 October 2026.
- Companion: `project-foundation-report.md` (tooling and file-level detail) and `docs/audit-2026-10-24.md` (the review that produced this revision).

## 1. Product Definition

SaaS Page Builder (`saas-page-builder`) is a multi-tenant B2B SaaS visual page builder, publishing engine, and conversion link platform for agencies, product teams, and multi-brand operators.

- **Tenancy unit**: every workspace is an `accounts` row that owns its sites, pages, immutable page versions, site globals, custom domains, media assets, import jobs, workspace templates, short links, audit events, and encrypted guest contacts.
- **Database-enforced isolation**: PostgreSQL 18 forced Row-Level Security with composite `(id, account_id)` keys and composite `(parent_id, account_id)` foreign keys, so a query bug cannot cross tenants.
- **Three surfaces**: `app/(public)/` (marketing, auth, `/my-data`, `/go/[code]`, `/scan/[segment]`, `/s/[siteSlug]/[[...path]]`), `app/(app)/` (signed-in workspace), and `app/admin/` (platform console reachable only through `ADMIN_PATH`).

## 2. Route Groups

1. `app/(public)/` - marketing (`/`, `features`, `pricing`, `faq`, `privacy`, `terms`), authentication (`sign-in`, `sign-in/two-factor`, `sign-up`, `forgot-password`, `reset-password`, `accept-invitation`, `signed-out`), GDPR self-service (`my-data`), the short-link surfaces (`go/[code]`, `scan/[segment]`), and the published-site renderer (`s/[siteSlug]/[[...path]]`, which also serves custom-domain hosts rewritten by `proxy.ts` to `/s/_custom`).
2. `app/(app)/` - dashboard, `sites`, `sites/[siteId]` (overview, pages, editor, preview, globals, domains, media, imports, settings), `sites/new`, `templates`, `domains`, `media`, `imports`, `analytics`, `team`, `export`, `settings`.
3. `app/admin/` - 16 operator areas plus an overview: accounts, audit, backups, components, domains, imports, media, operations, privacy, roles, settings, short-links, sites, templates, users. `proxy.ts` rewrites `ADMIN_PATH` to `/admin` and answers `404` for direct `/admin` probes.
4. `app/api/` - `auth/[...all]`, `files/[id]`, `health`, `health/ready`, `internal/tls-check`, `og`, `realtime`, `realtime/platform`.
5. `app/webhooks/` - `stripe` (Stripe `t=`/`v1=` signature scheme with a 300-second tolerance) and `domain-tls` (internal HMAC).

## 3. Core Capabilities

### Workspace, sites, and the block studio

- Multiple sites per workspace; each site owns pages, navigation/footer/defaults rows in `site_contents`, domains, media, imports, and templates.
- 35 typed blocks in `lib/registry/blocks.ts`, grouped into five catalogue groups (`site-frame`, `conversion`, `money`, `content`, `utility`) and five waves, with a validation pass before any draft is stored.
- Publishing writes an immutable `page_versions` row and repoints `pages.published_version_id`; rollback appends a new version instead of mutating history.
- Draft saves use optimistic locking (`lock_version`) and replace the page's `tracking_placements` rows in the same transaction.

### Custom domains

- `site_domains` rows start `pending` with a `verificationToken`; the TXT record lives at `_spb-verify.<hostname>`.
- Verification is real: `verifyCustomDomain` transitions `pending -> verifying`, resolves the TXT record, and only then moves the row to `active` (certificate state `pending`) or `failed`. A workspace cannot claim a hostname it does not control, and the unique hostname index prevents two workspaces from claiming the same one.
- `verify_active_tls_domain()` gates `GET /api/internal/tls-check`, so only active, non-removed domains reach TLS provisioning.

### Media, imports, templates, short links

- Uploads are presigned through Cloudflare R2 (`app/server/storage/r2.ts`), recorded in `media_assets`, deduplicated per site by checksum, reference-checked before retirement, and purged after a 30-day retention window by `media.orphan-sweep`.
- HTML imports are parsed with cheerio into reviewable segments, then applied through the reviewed-import path; import jobs carry their status through the `import` lifecycle table.
- Platform templates are curated by operators; workspace templates are cloned documents with regenerated block ids.
- Short links are 22-character opaque codes stored only as HMAC hashes, expire per kind (`invitation` 7 days, `preview` 1 hour, `export`/`password_reset` 30 minutes, `my_data` 1 hour), and are resolved through `resolve_short_link_by_hash()`. `/go` answers crawlers with an empty `200` so chat unfurlers never burn a link.

### Authorization and audit

- Roles: `owner` = `admin` (all 20 account capabilities) > `editor` > `viewer`; platform roles are `superadmin`, `support`, `auditor`, `none` across 12 platform capabilities.
- Every `"use server"` mutation calls a capability guard (`requireAccountCapability`, `requirePlatformCapability`) or a public rate limit (`requirePublicActionRateLimit`), and every state change writes an `account_audit_logs` or `platform_audit_logs` row inside the same transaction.

### Privacy

- Guest contacts are sealed with AES-256-GCM (`GUEST_CONTACT_KEY`) and looked up only by HMAC-SHA256 (`GUEST_LOOKUP_KEY`). Only `app/server/privacy` (and the SECURITY DEFINER reveal function) touch the ciphertext.
- `/my-data` erasure deletes by lookup hash and writes an immutable `erasure_logs` tombstone; the `privacy.erasure` job replays that log so a restored backup cannot resurrect erased contacts.
- Self-service erasure is rate limited by the proxy-derived client IP, not by a client-supplied key.

## 4. Background Work

`pg-boss` runs in the `pgboss` schema of the same database. `scripts/worker.ts` registers one real handler per queue and refuses to start when a declared queue has no handler:

| Queue | Cadence | Work |
| --- | --- | --- |
| `page.scheduled-publish` | every minute | Publishes drafts whose `scheduled_publish_at` has passed |
| `page.scheduled-unpublish` | every minute | Returns published pages to draft at `scheduled_unpublish_at` |
| `domain.verify` | every 15 minutes | Re-checks `pending`/`verifying`/`failed` custom domains over DNS |
| `privacy.erasure` | daily 02:00 | Replays the erasure log against stored contacts |
| `media.orphan-sweep` | daily 02:30 | Purges retired media rows past the retention window |
| `sweeper.daily` | daily 03:00 | Purges expired keep-windows, short links, and auth sessions |

Every queue carries an explicit retry limit, backoff, expiry, retention window, and `.dlq` dead-letter queue, pinned by `verify:queue-policies`. The worker writes `worker_heartbeats` every 15 seconds; `scripts/worker-healthcheck.ts` fails the container health check when that heartbeat is stale or the worker stopped claiming work.

## 5. Realtime

`publishAccountChange()` issues `pg_notify` on `account_changed` with a topic and ids only. `app/server/realtime/listener.ts` multiplexes one PostgreSQL `LISTEN` connection into subscriber callbacks, and `hooks/use-realtime-refresh.ts` refreshes the route in the browser. Server actions never call `revalidatePath`.

## 6. Non-Functional Requirements

- **Data stores**: PostgreSQL 18 and Valkey only; no embedded database and no in-memory fallback.
- **Published-page cache**: `resolvePublishedPage` caches resolved snapshots in Valkey for 120 seconds under `pub:page:<host-or-slug>:<path>` and registers each key in `pub:index:<siteId>`; publishing, rollback, global publishing, and site status changes drop that index so readers never see a stale site.
- **Localization**: `en-GB` canonical plus `en-US` parity (233 keys, checked by `verify:message-catalog`) and guest overlays `de`, `en-NG`, `es`, `fr`, `nl`. No hardcoded JSX strings (`react/jsx-no-literals`).
- **Accessibility**: WCAG 2.1 AA contrast enforced statically on `:root`/`.dark` tokens (`verify:contrast`) and dynamically through Playwright + axe-core.
- **Quality gate**: 24 checks in `scripts/verify-plan.ts`, executed by `scripts/verify-gate.ts`, journaled to `.verify-logs/history.jsonl`, with 80% Vitest coverage on all four metrics.

## 7. Repository Facts

- Stack: Bun `1.4.4`, Next.js 16 App Router (`output: "standalone"`), React 19, strict TypeScript, Drizzle ORM, `pg-boss`, `ioredis`, Better Auth, Tailwind CSS 4, Zod 4.
- 34 tables in one migration (`drizzle/0000_initial_schema.sql`), 16 of them tenant-scoped with forced RLS.
- Quality gates run locally through four Husky hooks (`pre-commit`, `commit-msg`, `post-merge`, `pre-push`); there is no hosted CI.
- Deployment is a three-service hardened Compose stack (`migrate`, `web`, `worker`) behind Coolify's Caddy; see `docs/deployment.md`.
