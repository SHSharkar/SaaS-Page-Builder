# AGENTS.md - SaaS Page Builder Instructions

Read `.specify/memory/constitution.md`, `project-scope.md`, and `project-foundation-report.md` before changing schema, server modules, UI components, or verification scripts.

## Mandatory Working Rules

1. **Runtime & Commands**
   - Always use Bun (`bun`, `bunx --bun`). Never introduce npm/yarn/pnpm lockfiles or lifecycle scripts without updating `trustedDependencies`.
   - Run `bun run verify:fast` for docs-only changes, `bun run verify:code` while iterating on source, and the full `bun run verify` before completing architectural changes. `bun run verify:log` shows recent gate runs.

2. **Database, RLS & Migrations**
   - Tenant-scoped tables must declare `accountId` (`account_id`), composite `(id, account_id)` uniqueness, composite foreign keys for sibling tenant tables, and forced RLS in `drizzle/*.sql` with the `account_isolation` policy on `app.account_id` and `app.platform_bypass`.
   - Wrap tenant reads/writes in `withAccount(accountId, (tx) => ...)` and cross-tenant/platform operations in `withPlatform((tx) => ...)`; only files listed in `scripts/lib/bare-database-allowlist.json` may import the bare client.
   - Every SQL migration in `drizzle/` must pass `bun run verify:migrations`, `bun run verify:migration-safety`, `bun run verify:rls`, and `bun run verify:tenant-delete`.

3. **Server & Client Boundaries**
   - Every module in `app/server/**` starts with `import "server-only";`.
   - Modules in `lib/**`, `components/**`, and `hooks/**` must never import `app/server/**` (`verify:client-boundary`, `.dependency-cruiser.mjs`, ESLint `no-restricted-imports`).
   - Formatting of money and dates lives exclusively in `lib/money.ts` and `lib/dates.ts`.

4. **Background Jobs**
   - Every queue in `lib/enums/job-kind.ts` needs a policy in `QUEUE_POLICY_MAP`, a handler in `app/server/jobs/handlers.ts`, and a schedule when it is periodic. `scripts/worker.ts` refuses to start when a handler is missing.

5. **Custom Domains**
   - A custom domain becomes `active` only after `verifyCustomDomain` matches the `_spb-verify.<hostname>` TXT record. Never set `status`/`certificateState` directly.

6. **UI, Copy & Code Quality**
   - Compose pages and forms exclusively from `components/ui/*` primitives (`Surface`, `Stack`, `Text`, `Button`, `Input`, `Textarea`, `Label`, `Form`, `Fieldset`, `FormSelect`, `SearchableSelect`, `DatePicker`, `TimePicker`, `Dialog`, `TabsPanel`, `DataTable`, `Badge`, `AppLink`, `LiveRegion`).
   - Add every user-facing string to both `messages/en-GB.json` and `messages/en-US.json` with identical `{placeholder}` tokens.
   - Keep zero comments (`house/no-source-comments`), zero `console.*` (`no-console`), alphabetical JSX props (`react/jsx-sort-props`), and cyclomatic complexity `<= 15`.
