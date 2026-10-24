# SaaS Page Builder - Project Scope

## 1. Product Vision & Multi-Tenant SaaS Model

**SaaS Page Builder** (`saas-page-builder`) is a multi-tenant B2B SaaS visual page builder, custom-domain publishing engine, and conversion link platform engineered for agencies, product teams, and multi-brand operators.

- **Tenancy unit**: Every customer workspace is an `accounts` row owning its sites, pages, immutable snapshots, global navigation/footer/SEO configs, custom domains, media assets, site import jobs, workspace templates, short links, audit events, and encrypted guest contacts.
- **Database-enforced tenant isolation**: PostgreSQL 18 Row-Level Security (`ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`) with composite `(id, account_id)` foreign keys guarantees zero cross-tenant reads or writes even under application query bugs.
- **Three strict surface boundaries**:
  1. `app/(public)/` - Marketing pages, authentication (`sign-in`, `sign-up`, `two-factor`, `forgot-password`, `reset-password`, `accept-invitation`, `signed-out`), GDPR self-service (`/my-data`), short-link & QR crawler shield (`/go/[code]`, `/scan/[segment]`), and immutable snapshot rendering (`/s/[siteSlug]/[[...path]]` plus custom-domain host routing via `proxy.ts`).
  2. `app/(app)/` - Authenticated workspace shell (`dashboard`, `sites`, `sites/[siteId]/*`, visual Puck-compatible block studio, `templates`, `domains`, `media`, `imports`, `analytics`, `team`, `export`, `settings`).
  3. `app/admin/` - Stealth platform operator console mounted exclusively at `ADMIN_PATH` (`proxy.ts` rewrites `ADMIN_PATH` -> `/admin` and returns `404` for direct `/admin` probes) with 16 operational tabs (`overview`, `accounts`, `sites`, `domains`, `templates`, `components`, `users`, `roles`, `imports`, `media`, `short-links`, `audit`, `settings`, `operations`, `backups`, `privacy`).

## 2. Core Functional Capabilities

1. **Multi-Site Workspace & Visual Block Studio**
   - Create and manage multiple sites per workspace (`sites`), governed by subscription tier (`plans`).
   - Author draft `PageDocument` trees across 35 strongly typed blocks organized into 7 waves (`layout`, `hero`, `content`, `conversion`, `media`, `navigation`, `advanced`).
   - Publish immutable `page_snapshots` and atomically switch or roll back `sites` / `pages` pointers without mutating historical snapshots.
   - Manage site-wide globals (`site_globals` for header navigation, footer links, announcement bar, and default SEO metadata).

2. **Custom Domains, TLS Verification & Host Routing**
   - Attach apex or subdomain hostnames (`site_domains`) with generated DNS TXT verification tokens (`_spb-verify.<hostname>`).
   - Verify DNS ownership and track TLS provisioning states (`pending_dns`, `verified`, `provisioning_tls`, `active`, `failed`), guarded by `/api/internal/tls-check` and `/webhooks/domain-tls`.
   - SSRF-safe outbound URL validation (`app/server/network/outbound-url.ts`) blocks loopback, RFC1918, CGNAT, link-local, and cloud metadata IPs on all remote fetches and site imports.

3. **Templates, Media Library & Site Imports**
   - Curate platform-wide starter templates (`platform_templates`) and promote workspace layouts (`account_templates`).
   - Upload and track media assets (`media_assets` + `media_variants`) backed by Cloudflare R2 presigned/object storage (`app/server/storage/r2.ts`) and served via `/api/files/[id]`.
   - Queue asynchronous site HTML imports (`site_import_jobs`) processed by `pg-boss` workers (`site.import`).

4. **Short Links, QR Codes & Crawler Shield**
   - Issue 22-character opaque short links (`short_links`) for published pages and campaigns (`/go/[code]` and `/scan/[segment]`).
   - Detect link-preview crawlers (`Slackbot`, `WhatsApp`, `Discordbot`, `Twitterbot`, `facebookexternalhit`, etc.) via `lib/crawler-agents.ts` and return static preview HTML with `Referrer-Policy: no-referrer` so one-time or tracked tokens are never burned by chat unfurlers.

5. **Team RBAC, Capabilities & Audit Trail**
   - Workspace roles (`owner`, `admin`, `editor`, `viewer`) and platform roles (`superadmin`, `support`) map deterministically to granular capabilities (`app/server/capabilities/index.ts`).
   - Every state-changing Server Action enforces `requireAccountCapability` or `requirePlatformCapability` and appends an immutable `audit_events` record.

6. **GDPR Privacy, Encrypted Contacts & Keep-Window Lifecycle**
   - Guest contact details (`guest_contacts`) are encrypted at rest with AES-256-GCM (`GUEST_CONTACT_KEY`) and looked up only via HMAC-SHA256 (`GUEST_LOOKUP_KEY`).
   - Self-service erasure (`/my-data`) and operator erasure purge ciphertext rows and record an `erasure_logs` tombstone replayed automatically after backup restores (`scripts/replay-erasure-log.ts`).
   - Workspace and site deletions enter a configurable soft-delete keep-window (`purge_after_at`) before irreversible physical cascade deletion by `sweeper.daily` (`app/server/sweeper/index.ts`).

## 3. Non-Functional & Operational Requirements

- **Strict Data Stores**: PostgreSQL 18 + Valkey (`ioredis`) only; zero embedded databases or in-memory fallbacks.
- **Realtime Invalidation**: PostgreSQL `LISTEN` / `NOTIFY` bridged to Server-Sent Events (`/api/realtime` and `/api/realtime/platform`) with `ClientRealtimeListener` triggering `router.refresh()`.
- **Localization**: Full `en-GB` (canonical) and `en-US` message catalog parity (`verify:message-catalog`) plus guest locale overlays (`de`, `en-NG`, `es`, `fr`, `nl`), with zero hardcoded JSX strings (`react/jsx-no-literals`).
- **Accessibility**: WCAG 2.1 AA contrast verified statically on `:root` and `.dark` tokens (`verify:contrast`) and dynamically via Playwright + `@axe-core/playwright`.
- **Quality Gate**: 24-step verification plan (`scripts/verify-plan.ts`), 80% minimum Vitest coverage across lines, statements, functions, and branches, strict ESLint house rules (`house/no-source-comments`, `no-console`, `complexity <= 15`), Stylelint, `.dependency-cruiser.mjs`, `knip`, `gitleaks`, and 4 POSIX `.husky/` hooks.
