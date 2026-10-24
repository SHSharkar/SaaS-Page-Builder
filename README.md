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
- `npx tsx scripts/smoke.ts` — exercise the data layer end to end against a throwaway database

Environment variables (all optional in development):

| Variable | Default | Purpose |
| --- | --- | --- |
| `PGLITE_DIR` | `./data/pg` | Database directory. Point at a real Postgres by swapping the driver in `lib/db`. |
| `MEDIA_DIR` | `./data/media` | Where uploaded bytes live. Production uses Cloudflare R2 with the same identifiers. |
| `PLATFORM_DOMAIN` | `pages.trofeo.test` | Suffix for generated platform subdomains. |
| `ALLOW_HOST_FALLBACK` | `true` | Serve the first active site when a host is unknown (preview environments). Set `false` in production so an unknown host 404s. |

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

**Media.** Uploads are byte-verified (magic bytes, not the file name), capped at 5 MB, stored under a
content hash and deduplicated per site. Documents store media *identifiers*, never URLs, so the
reference check before deletion is exact: a draft, a snapshot, a global or a staff template that
still names the asset blocks the delete.

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

## The component library

35 definitions in five groups: `site-frame` (header, footer, announcement bar, sticky CTA),
`conversion` (hero, promo banner, CTA banner, urgency strip, countdown, testimonial, trust badges),
`money` (bonus grid, bonus table, jackpot, payout proof, gift-card grid, trophy rewards, VIP tiers),
and `content` (rich text, image, carousel, video embed, cards, steps, features, FAQ, divider, logos,
games grid, comparison) plus utility blocks.

Browse them, with live previews and their field schemas, at `/admin/components`.

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
```

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
  api/sites/[siteId]/media        upload endpoint
lib/
  registry/                       component definitions (the single source of truth)
  pages.ts globals.ts media.ts domains.ts templates.ts importer.ts
  render.tsx public-page.ts       public tree and metadata
  cache.ts queue.ts audit.ts      Valkey-shaped cache, job queue, audit trail
  actions/                        server actions — the only mutation surface
components/
  blocks/                         rendered sections
  editor/                         Puck adapter, custom fields, editor chrome
  admin/                          screens and client widgets
drizzle/                          SQL migrations
scripts/                          migrate, seed, smoke
```

## Decisions worth knowing

- **Puck is an implementation detail.** Documents are stored as
  `{ schemaVersion, root: { props }, content: [{ type, props }] }`. The public renderer walks that
  tree directly, so visitor pages ship none of the editor.
- **PGlite, not Postgres, in this build.** The SQL, JSONB queries (`jsonb_path_exists` for the media
  reference check) and Drizzle schema are the production ones; only the transport differs.
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
