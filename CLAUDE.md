# CLAUDE.md

Follow `AGENTS.md` and `.specify/memory/constitution.md` as the authoritative engineering ruleset for `SaaS Page Builder`.

## Essential Reference Commands

- `bun run db:migrate` - Apply SQL migrations and verify Drizzle checksums
- `bun run db:seed:development` - Seed plans, roles, 35 block definitions, platform templates, demo workspace, and operator account
- `bun run lint` / `bun run lint:css` - Run ESLint (house rules, boundaries, zero warnings) and Stylelint
- `bun run typecheck` - Run strict TypeScript check (`tsc --noEmit`)
- `bun run test` / `bun run test:coverage` - Run Vitest unit + live PostgreSQL/Valkey integration tests (80% coverage floor across lines, statements, functions, and branches)
- `bun run verify` - Execute the complete 24-step verification gate and write `.verify-logs/latest.json`
- `bun run test:e2e` - Execute Playwright + `@axe-core/playwright` WCAG 2.1 AA end-to-end checks
