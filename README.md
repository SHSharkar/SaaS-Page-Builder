# Trofeo Pages

Trofeo Pages is an internal, invite-only multi-site landing page builder and publishing platform built on a self-hostable open-source stack. Staff compose landing pages from a code-owned catalog of 35 structured blocks, manage site-wide navigation, footer, and default SEO once per property, verify custom domains with on-demand TLS gating, import and review raw HTML pages, and publish immutable snapshots with instant rollback.

## Technology Stack

- Runtime and framework: Next.js 16 App Router (`next@16.4.3`), React 19 (`react@19.3.1`), TypeScript 6 (`typescript@6.0.3`), and Next.js `proxy.ts` security header and route framing guard.
- Styling and UI: Tailwind CSS v4 (`@tailwindcss/postcss@4.3.3`) configured exclusively through `@import "tailwindcss";` and `@theme` tokens in `app/globals.css`, paired with `class-variance-authority`, `clsx`, `tailwind-merge`, and `lucide-react`.
- Visual editor: Puck (`@puckeditor/core@0.23.0`) backed by a single code-owned block registry in `lib/registry` shared between the editor canvas, staff preview routes, and zero-editor public server rendering.
- Database: PostgreSQL via `pg` (`pg@8.23.1`) and Drizzle ORM (`drizzle-orm@0.45.4`, `drizzle-kit@0.31.11`) with 23 enum-free tables and partial unique indexes, plus embedded PGlite (`@electric-sql/pglite@0.5.11`) for zero-dependency local development and test suites when `DATABASE_URL` is unset.
- Cache and rate limiting: Valkey / Redis via `ioredis` (`ioredis@6.0.0`) with an automatic in-memory fallback when `VALKEY_URL` is not configured.
- Background jobs: `pg-boss` (`pg-boss@12.38.0`) standalone worker (`scripts/worker.ts`) for scheduled publish, scheduled unpublish, domain DNS verification, HTML import processing, site purge, and daily cleanup sweeps.
- Identity and authorization: Better Auth (`better-auth@1.7.12`, `@better-auth/drizzle-adapter@1.7.12`, `@better-auth/passkey@1.7.12`) with NFKC-normalized Argon2id (`@node-rs/argon2@2.2.2`), WebAuthn passkeys, TOTP two-factor authentication (`otpauth@9.5.2`) with encrypted backup codes, 10-minute password step-up confirmation, single-use hashed staff invitations, and a 44-permission rank-ceiling RBAC matrix.
- Object storage: AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) supporting Cloudflare R2 or any S3-compatible bucket via presigned PUT uploads, with verified local filesystem fallback (`MEDIA_DIR`), magic-byte MIME sniffing, SVG sanitization, SHA-256 deduplication, and reference-checked deletion.
- Observability and API errors: Pino (`pino@10.4.0`) structured JSON logging with sensitive-key redaction, RFC 9457 `application/problem+json` error responses with `X-Request-Id`, `Retry-After`, and `Allow` headers, and `/api/health` readiness probes.

## Getting Started

```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

When `DATABASE_URL` is set, the application connects to PostgreSQL and expects migrations and seed data to be applied explicitly via `npm run db:migrate` and `npm run db:seed` rather than during server boot. When `DATABASE_URL` is omitted in local development or tests, the runtime uses embedded PGlite under `PGLITE_DIR` (`./data/pg` by default).

## Scripts

- `npm run dev` starts the Next.js development server on default port 3000.
- `npm run build` compiles the production Next.js bundle.
- `npm run start` starts the production Next.js server.
- `npm run worker` runs the standalone `pg-boss` background job worker (`scripts/worker.ts`).
- `npm run db:generate` generates SQL migrations from `lib/db/schema.ts` into `drizzle/`.
- `npm run db:migrate` applies pending SQL migrations (`scripts/migrate.ts`).
- `npm run db:seed` seeds the RBAC catalog, component definitions, platform settings, demo staff accounts, and sample site (`scripts/seed.ts`).
- `npm run smoke` runs end-to-end service-layer smoke checks against an isolated database (`scripts/smoke.ts`).
- `npm run typecheck` runs `tsc --noEmit` across application, script, and test sources.
- `npm run lint` runs ESLint 10 across the repository.
- `npm test` runs the Vitest suite across auth, RBAC, state machines, publishing, media, sweeper, rendering, registry, and platform security guards.

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string (`postgres://...`). Required in production unless `ALLOW_EMBEDDED_DB=true`.
- `DATABASE_POOL_MAX`: Maximum connections in the PostgreSQL pool (defaults to `10`).
- `PGLITE_DIR`: Directory path or `memory://` target for embedded PGlite in local development and tests (defaults to `./data/pg`).
- `VALKEY_URL`: Valkey or Redis URL (`redis://...`) for shared caching and sliding-window rate limits.
- `BETTER_AUTH_SECRET`: Secret key (minimum 32 characters) used by Better Auth to sign session cookies.
- `BETTER_AUTH_URL`: Canonical origin URL for authentication callbacks and WebAuthn ceremonies (defaults to `http://localhost:3000` in development).
- `PASSKEY_RP_ID`: Relying-party hostname for WebAuthn passkeys (defaults to the hostname of `BETTER_AUTH_URL`).
- `PASSKEY_ORIGIN`: Allowed origin for WebAuthn passkey ceremonies (defaults to the origin of `BETTER_AUTH_URL`).
- `SETTINGS_ENCRYPTION_KEY`: Key material (minimum 16 characters, HKDF-SHA256 derived to 256 bits) used for AES-256-GCM encryption of secret values in `platform_setting`.
- `PLATFORM_DOMAIN`: Base suffix for generated site subdomains (defaults to `pages.trofeo.test`).
- `ALLOW_HOST_FALLBACK`: When `true` in local preview environments, unknown `Host` headers fall back to the first active site; set `false` in production so unknown hosts return 404.
- `INTERNAL_TLS_CHECK_TOKEN`: Optional bearer token required by `GET /api/internal/tls-check?domain=...` when Caddy queries certificate eligibility.
- `MEDIA_DIR`: Local directory storing uploaded media blobs when S3 / R2 credentials are not configured (defaults to `./data/media`).
- `S3_ENDPOINT` or `R2_ACCOUNT_ID`: Object storage endpoint or Cloudflare account identifier enabling presigned PUT uploads.
- `S3_BUCKET` or `R2_BUCKET`: Bucket name for uploaded media objects.
- `S3_ACCESS_KEY_ID` or `R2_ACCESS_KEY_ID`: Object storage access key identifier.
- `S3_SECRET_ACCESS_KEY` or `R2_SECRET_ACCESS_KEY`: Object storage secret access key.
- `S3_PUBLIC_BASE_URL` or `R2_PUBLIC_BASE_URL`: Public CDN or bucket base URL for serving ready media objects.
- `LLM_ADAPTER`: Optional HTML import classification adapter (`none` by default).

## Demo Staff Accounts

Running `npm run db:seed` provisions three demo accounts sharing the password `TrofeoDemo2026!`:

- `admin@trofeo.example` (`admin`, rank 100): Full platform access across sites, pages, custom domains, raw HTML and embed blocks, staff invitations, custom roles, settings, and operations.
- `editor@trofeo.example` (`editor`, rank 50): Creates and edits drafts, publishes snapshots, manages site globals, uploads media, applies templates, and reviews HTML imports.
- `viewer@trofeo.example` (`viewer`, rank 10): Read-only access to sites, pages, version history, global content, domains, templates, and the component catalog.

## Core Capabilities

- Multi-site routing and on-demand TLS: Visitors are routed by `Host` header and path to the active site's published `page_version` snapshot without loading editor JavaScript. Unknown hosts, suspended sites, unpublished drafts, and archived pages return a uniform 404 response. `GET /api/internal/tls-check?domain=...` returns HTTP 200 only when both the domain and its parent site are active, preventing certificate issuance for unverified or suspended hostnames.
- Optimistic locking and immutable snapshots: Page and global content drafts enforce a 200 KB JSONB ceiling (`schemaVersion` first) and compare `lock_version` on every save so concurrent edits never overwrite each other silently. Publishing records an immutable `page_version` snapshot, retains the newest 50 versions plus whichever snapshot is currently live, and supports instant rollback as a new version. A partial unique index (`page_one_homepage_idx`) guarantees one active homepage per site.
- Component catalog: 35 code-owned blocks (27 Launch and 8 Wave-2) organized under `site-frame`, `conversion`, `money`, `content`, and `utility`. All blocks share normalized appearance tokens (background, spacing, width, alignment, device visibility, and anchor ID) and validate on the server before saving or publishing. Raw HTML (`raw-html`) and iframe (`embed`) blocks require the `catalog.admin_blocks` permission.
- Media pipeline and reference tracking: Uploads support presigned PUT to S3 / R2 or direct local upload, capped at 10 MB per file and 60 uploads per actor per hour. Confirmation verifies magic bytes, sanitizes SVG markup, deduplicates by SHA-256 content hash, extracts image dimensions, and tracks usage in `media_reference` across page drafts, published versions, global headers and footers, site themes, and templates so referenced assets cannot be deleted accidentally.
- SSRF-guarded HTML importer: Staff upload or paste HTML (up to 5 MB, 20 imports per day) for Cheerio structural segmentation into candidate blocks. Remote asset fetches enforce DNS and IP range validation blocking loopback, RFC 1918 private networks, link-local addresses, and cloud metadata endpoints (`169.254.169.254` and IPv6 equivalents). Reviewers accept, remap, skip, or (if authorized) keep sections as `raw-html` to produce an unpublished draft page.
- Security and lifecycle governance: Every entity (`site`, `page`, `domain`, `import`, `media`, `invite`, and `template`) transitions exclusively through `assertTransition` in `lib/lifecycle.ts`. Sensitive mutations require a fresh 10-minute password step-up window (`428 Precondition Required`), role rank ceilings prevent privilege escalation, the last active administrator cannot be demoted or banned, and `runDailyCleanup` in `lib/sweeper.ts` purges expired trash, unconfirmed uploads, old import jobs, and expired sessions.

## Repository Structure

- `app/`: Next.js App Router public routes (`[[...path]]`), staff previews (`preview/`), visual editor routes (`edit/`), admin console (`admin/`), auth screens (`sign-in`, `two-factor`, `invite`, `reset-password`), per-host `sitemap.xml` and `robots.txt`, media delivery (`media/[file]`), and API endpoints (`api/auth`, `api/health`, `api/internal/tls-check`, `api/sites/[siteId]/media`).
- `components/`: Shared UI primitives, centered modal dialogs, admin workflow panels, Puck editor adapter (`components/editor/`), and public block renderers (`components/blocks/`).
- `lib/`: Domain services (`sites`, `pages`, `globals`, `domains`, `media`, `importer`, `templates`, `team`, `overview`, `settings`, `audit`, `sweeper`, `queue`, `cache`), Better Auth and RBAC (`lib/auth/`), Drizzle schema (`lib/db/`), block registry (`lib/registry/`), Server Actions (`lib/actions/`), AES-256-GCM encryption (`lib/crypto.ts`), Pino logger (`lib/logger.ts`), and RFC 9457 responses (`lib/problem.ts`).
- `drizzle/`: Generated PostgreSQL migration SQL and metadata journal.
- `scripts/`: Standalone CLI entry points for `migrate.ts`, `seed.ts`, `worker.ts`, and `smoke.ts`.
- `tests/`: Vitest integration and unit suites covering RBAC, lifecycles, pages, media, rendering, registry, sweeper, and platform security guards.
- `proxy.ts` and `instrumentation.ts`: Next.js 16 request header proxy and server boot hook.
