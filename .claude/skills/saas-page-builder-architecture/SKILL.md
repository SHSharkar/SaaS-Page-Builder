---
name: saas-page-builder-architecture
description: Authoritative architecture, multi-tenant RLS, UI primitive, localization, and verification workflow skill for SaaS Page Builder.
---

# SaaS Page Builder Architecture Skill

## When to Use

Invoke this skill whenever adding or modifying:
- Drizzle tables or SQL migrations (`app/server/db/schema/*`, `drizzle/*`)
- Server Actions, route handlers, or `pg-boss` background jobs (`app/server/*`, `app/api/*`, `app/webhooks/*`)
- Workspace, public, or stealth admin UI pages (`app/(app)/*`, `app/(public)/*`, `app/admin/*`, `components/*`)
- Verification checks or deployment manifests (`scripts/verify-*.ts`, `Dockerfile*`, `docker-compose.yml`)

## Checklist

1. **Tenancy & RLS**: Does any new tenant table include `account_id`, `(id, account_id)` uniqueness, composite tenant FKs, `ENABLE/FORCE ROW LEVEL SECURITY`, and `account_isolation`?
2. **Authz & Audit**: Does every `"use server"` mutation call `requireAccountCapability` or `requirePlatformCapability` (or `requirePublicActionRateLimit` for public flows) and record an audit trail inside the same transaction (`recordAccountAudit` / `recordPlatformAudit`)?
3. **UI & i18n**: Are all controls imported from `@/components/ui`, styled only with semantic tokens (`canvas`, `card`, `muted`, `accent`, `danger`, `ink`, `subtle`, `on-accent`, `border-subtle`), and backed by keys in both `messages/en-GB.json` and `messages/en-US.json`?
4. **Jobs & Domains**: Does every queue in `lib/enums/job-kind.ts` have a policy, a handler in `app/server/jobs/handlers.ts`, and (when periodic) a cron entry? Do custom domains only become `active` through `verifyCustomDomain` with a matching `_spb-verify.<hostname>` TXT record?
5. **Hygiene & Gate**: Are there zero comments, zero `console.*` statements, complexity `<= 15`, and green `bun run verify` results?
