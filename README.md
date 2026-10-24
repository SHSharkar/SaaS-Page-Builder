# Trofēo Pages

An internal, invite-only page builder for the Trofēo team: staff compose landing pages from a
code-defined component library, edit site-wide navigation and footer once, and publish immutable
snapshots that can be rolled back. Pages render from the same registry the editor uses, so a
component cannot look right in the editor and wrong for a visitor.

The build follows the six supplied documents (PRD, architecture, ADRs, design system, security
review, roadmap). Where a decision was open, the implementation note says which way it went.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

There is nothing to provision. The database is PostgreSQL compiled to WebAssembly (PGlite),
migrated and seeded automatically on first boot:

- `npm run db:migrate` — apply the shipped migrations, then seed a fresh database
- `npm run seed` — seed demo content (idempotent; existing data is never overwritten)
- `npm run typecheck` — `tsc --noEmit`
- `npm test` — the vitest suite (state machines, publishing, media, retention, rendering, catalog)
- `npx tsx scripts/smoke.ts` — exercise the data layer end to end against a throwaway database

Environment variables (all optional in development):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PGLITE_DIR` | `./data/pg` | Database directory. Point at a real Postgres by swapping the driver in `lib/db`. |
| `MEDIA_DIR` | `./data/media` | Where uploaded bytes live when R2 is not configured. |
| `R2_ACCOUNT_ID` | — | Cloudflare account id. Setting the five R2 variables switches media storage to the bucket. |
| `R2_ACCESS_KEY_ID` | — | R2 token key id. |
| `R2_SECRET_ACCESS_KEY` | — | R2 token secret. |
| `R2_BUCKET` | — | Bucket name for site media. |
| `R2_PUBLIC_BASE_URL` | — | Public bucket domain used to build asset URLs. |
| `PLATFORM_DOMAIN` | `pages.trofeo.test` | Suffix for generated platform subdomains. |
| `ALLOW_HOST_FALLBACK` | `true` | Serve the first active site when a host is unknown (preview environments). Set `false` in production so an unknown host 404s. |

Media storage is one contract (`lib/media/storage.ts`) with two backends. With the `R2_*` variables
present, uploads go straight from the browser to the bucket through a presigned PUT; without them the
same flow writes to `MEDIA_DIR` through our own route. Either way the server re-reads the bytes and
verifies type and checksum before the asset becomes usable.

## Demo accounts

Password for all three: **`TrofeoDemo2026`** (prefilled on the sign-in screen).

| Account | Role | Can do |
| --- | --- | --- |
| `admin@trofeo.example` | admin | Everything, including sites, staff, domains and platform settings |
| `editor@trofeo.example` | editor | Build, publish, import, upload media |
| `viewer@trofeo.example` | viewer | Read-only access to pages and history |

The seeded site is **Trofēo Reward** (`/`, `/rewards/wallet`, `/bonus-terms`) with a custom domain
awaiting verification, a pending invitation for `new.starter@trofeo.example`, three curated
templates and a second published version of the homepage so rollback has something to restore.

---

## What is implemented

**Editing.** Puck 0.23 is embedded behind one adapter (`components/editor/puck-config.tsx`). The 35
components come from `lib/registry`; each definition carries its own field schema, defaults, style
controls and render function, and the server re-validates every save against the same schema, so an
unknown or malformed component can never reach a document.

**Publishing.** A page has a draft and an immutable `page_version` snapshot. Publishing validates,
writes the snapshot, points `current_published_version_id` at it and clears the cache in the same
request. Rollback republishes an old snapshot as a *new* version — history is never rewritten. The
last 50 snapshots per page are kept. Saves carry `lock_version`; a stale save is refused rather than
silently overwriting another editor. One published homepage per site is enforced by a partial unique
index as well as in code.

**Site globals.** Navigation, footer and default search tags are edited once per site, with their
own drafts and their own publish step.

**Media.** Uploads are two-staged: `POST /api/sites/{id}/media/presign` creates a `pending` row and a
presigned PUT (or a null URL on the local backend), the bytes move, and
`POST /api/sites/{id}/media/{mediaId}/confirm` re-reads what landed, checks the magic bytes against
the declared type, verifies the SHA-256 the browser sends, deduplicates by content hash, renames the
object to that hash and only then flips the row to `ready`. Unconfirmed uploads are swept after 24
hours. Files are capped at 5 MB and 60 uploads per staff member per hour. Documents store media
*identifiers*, never URLs, so the reference check before deletion is exact: a draft, a snapshot, a
global or a staff template that still names the asset blocks the delete.

**Hostnames.** `domain` rows drive serving. A hostname is `pending` until its TXT record verifies,
then `active`; removing it stops serving immediately and clears the cache. Platform subdomains are
created automatically. Certificates are gated on that row (the "answer C" path in Q-004): no
certificate is issued for a hostname that has not verified.

**Public rendering.** Hostname → site → page → published snapshot, rendered through the registry.
Unknown host, unknown path, unpublished page and suspended site all produce the *same* 404. Pages
get per-page titles, descriptions, canonical URLs, share tags, optional noindex, `sitemap.xml` and
`robots.txt` per host. Staff previews are noindex, never cached, and show the draft.

**Imports.** Upload one HTML file (5 MB, 20 per staff member per day). The analyser maps sections to
components deterministically and records confidence, the reason, and everything it could not map.
Nothing is created until a human reviews the mapping and applies it; the result is an unpublished
draft. The same screen lets a reviewer remap a section to a different component, edit its copy, or
drop it.

**Templates.** Three curated designs built from the component library, plus staff templates saved
from any page. Tokens written as `{{token}}` become fill-in fields at creation time; applying a
template copies the document, so later edits never change the template.

**Operations.** Invite-only staff accounts with roles (admin/editor/viewer) enforced server-side,
optional TOTP two-factor, single-use invitations, a step-up check for sensitive acts, an append-only
audit log, a database-backed job queue with dedupe keys and exponential backoff, scheduled publish
and unpublish, and a platform settings screen (database > environment > default).

**Lifecycles and retention.** Every status change goes through the state machines in
`lib/lifecycle.ts` (`assertTransition`); an illegal move is a typed 409, not a silent write. The
machines are:

| Object | States |
| --- | --- |
| Page | `draft` ↔ `published` → `archived` → `draft` (a restored page comes back as a draft) |
| Site | `active` ↔ `suspended` → `deleted` → `active` (restore) |
| Domain | `pending` → `verifying` → `active` \| `failed` → `pending` \| `removed` |
| Import | `uploaded` → `parsing` → `mapped` → `in_review` → `applied` \| `discarded` \| `failed` |
| Media | `pending` → `ready` → `deleted` |
| Invite | `pending` → `accepted` \| `revoked` \| `expired` |

Deleting a site is two-staged. The site stops serving immediately, its domains are removed, the cache
is cleared and rows are kept for a **30-day restore window** (`/admin/sites` → *Recently deleted* →
Restore or Purge now). A daily queue job hard-deletes anything past the window; restoring cancels
that purge because the job re-checks the row.

One sweeper (`runDailyCleanup`, job kind `cleanup.daily`) owns every keep window, and running it twice
changes nothing the second time:

| Data | Kept |
| --- | --- |
| Audit log | 24 months |
| Snapshots per page | 50 (oldest pruned, the live snapshot is never removed) |
| Import jobs | 90 days |
| Import source files | 12 months, and only once nothing references them |
| Unconfirmed uploads | 24 hours |
| Deleted sites | 30 days, then purged |
| Removed hostnames | 90 days, then the name is free again |
| Suspended sites | reviewed after 12 months |

The counts and a *Run the sweeper now* button live on `/admin/settings`.

## The component library

35 definitions in five groups: `site-frame` (header, footer, announcement bar, sticky CTA),
`conversion` (hero, promo banner, CTA banner, urgency strip, countdown, testimonial, trust badges),
`money` (bonus grid, bonus table, jackpot, payout proof, gift-card grid, trophy rewards, VIP tiers),
and `content` (rich text, image, carousel, video embed, cards, steps, features, FAQ, divider, logos,
games grid, comparison) plus utility blocks.

27 ship at launch and 8 more (`live-winners`, `vip-tiers`, `responsible-gaming`, `app-download`,
`team-grid`, `timeline`, `image-gallery`, `schedule-table`) carry `wave: 2`, so the second wave is
visible in the catalog and filterable without changing the editor. Browse them, with live previews
and their field schemas, at `/admin/components`.

Every component also supports the shared `appearance` controls (background, spacing, width,
alignment, per-device visibility, anchor id), so layout rhythm is consistent without each component
inventing its own.

## Verified behaviour

`scripts/smoke.ts` runs the real functions the server actions call, against a disposable database:

```
• sites and pages      validation, nested slugs, homepage rule, lock-version conflict,
                       publish → v1, publish → v2, rollback → v3, unpublish
• globals              navigation publish, default SEO round-trip
• media                byte sniffing, checksum dedupe, reference-blocked delete
• import review        analysis + apply produces an unpublished page
• templates            curated templates exist and apply
• domains              pending + TXT instruction, no false-positive verification
• queue                a due job drains
• archived pages       archive → publish refused (409) → restore as draft → unpublish refused
• two-stage upload     pending row, presign presence, unconfirmed confirm refused, 5 MB cap
• retention            second sweep is a no-op, keep windows, preview counts
• site restore/purge   soft delete → restore → purge only when deleted
```

`npm test` covers the same promises at unit level (96 checks): every legal and illegal transition in
all eight machines, `lock_version` refusals, one-homepage enforcement, snapshot immutability and
pruning, media verification and dedupe, hostname resolution and the identical 404, metadata assembly,
and a catalog pass that renders all 35 components from their defaults.

The public routes, sitemap, robots, media route and every admin screen were also fetched over HTTP
and checked for expected markup and status codes.

## Layout

```
app/
  [[...path]]/page.tsx            public renderer (host → site → page → snapshot)
  preview/[siteId]/[[...path]]    staff-only, noindex draft preview
  admin/…                         dashboard, sites, pages, globals, media, domains,
                                  imports, settings, templates, components, team, audit
  edit/[siteId]/…                 Puck editor for pages and for global content
  media/[file]/route.ts           immutable, hashed media bytes
  sitemap.xml, robots.txt         per-host
  api/sites/[siteId]/media        upload (local backend), presign and confirm endpoints
lib/
  registry/                       component definitions (the single source of truth)
  lifecycle.ts retention.ts       state machines, keep windows, the daily sweeper
  pages.ts globals.ts media.ts domains.ts templates.ts importer.ts
  media/storage.ts                local | R2 behind one contract
  render.tsx public-page.ts       public tree and metadata
  cache.ts queue.ts audit.ts      Valkey-shaped cache, job queue, audit trail
  actions/                        server actions — the only mutation surface
components/
  blocks/                         rendered sections
  editor/                         Puck adapter, custom fields, editor chrome
  admin/                          screens and client widgets
drizzle/                          SQL migrations
scripts/                          migrate, seed, smoke
tests/                            vitest suites (lifecycle, pages, media, retention,
                                  rendering, catalog)
```

## Decisions worth knowing

- **Puck is an implementation detail.** Documents are stored as
  `{ schemaVersion, root: { props }, content: [{ type, props }] }`. The public renderer walks that
  tree directly, so visitor pages ship none of the editor.
- **PGlite, not Postgres, in this build.** The SQL, JSONB queries (`jsonb_path_exists` for the media
  reference check) and Drizzle schema are the production ones; only the transport differs. PGlite
  allows one writer per directory, so `lib/db` records its pid next to the data and clears a dead
  owner's lock on the next start; SIGTERM/SIGINT close the database before the process exits, which
  is what keeps the directory healthy across dev-server restarts.
- **Soft delete first, purge later.** A site delete is reversible for 30 days by design: the purge is
  a queued job that re-checks the row, so a restore always wins. Purging a live site is refused.
- **In-process cache instead of Valkey.** `lib/cache.ts` keeps the key shapes (`dom:`, `page:`,
  `site:`, `rl:`) and the rule that invalidation happens synchronously after commit; swapping in
  ioredis is a single file.
- **A database-backed queue instead of pg-boss.** Same semantics that matter here: unique dedupe
  key, attempts, backoff of `min(5 min, 2^attempts s)`, and a worker that must actually run. A tick
  runs every five seconds in-process and can be triggered from Platform settings.
- **No outbound DNS in the sandbox**, so domain verification reports "recheck from production
  resolver" rather than claiming success or failure it cannot know.
- **Host fallback on** for preview environments: an unrecognised host serves the first active site
  so the preview is usable. Set `ALLOW_HOST_FALLBACK=false` to get strict 404s.
- **Invitations are shown once** as a copyable link; there is no mail transport in this build. The
  accept screen, expiry and single-use rules are real.

## Out of scope (v1, per the documents)

Billing, forms/lead capture, customer workspaces, real-time co-editing, multi-language content and
customer-hosted video. Prompt-to-page is described but not wired to a model; the import analyser is
deterministic so it can run with no external service.
