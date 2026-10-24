---
name: saas-page-builder-architecture
description: Authoritative architecture, multi-tenant RLS, UI primitive, localization, and verification workflow skill for SaaS Page Builder.
---

# SaaS Page Builder Architecture Skill

1. Enforce `withAccount(accountId, fn)` and `withPlatform(fn)` for all database queries; never call `getDb()` directly in feature modules.
2. Require explicit capabilities (`requireAccountCapability` / `requirePlatformCapability`) on every mutation and page guard.
3. Build UI exclusively from `@/components/ui` primitives and semantic CSS tokens (`app/globals.css`), maintaining 100% parity between `messages/en-GB.json` and `messages/en-US.json`.
4. Maintain zero source comments, zero `console.*`, complexity `<= 15`, and run `bun run verify` before finishing work.
