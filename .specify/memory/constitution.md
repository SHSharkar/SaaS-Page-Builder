# SaaS Page Builder - Project Constitution

## 1. Non-Negotiable Architectural Invariants

1. **Multi-Tenant Isolation via Forced PostgreSQL RLS**
   - Every tenant-owned table carries `account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`, composite `(id, account_id)` unique keys, and composite `(child_fk, account_id)` foreign keys.
   - Every tenant-owned table enables `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY` with an `account_isolation` policy bound to `current_setting('app.account_id', true)` and `current_setting('app.platform_bypass', true)`.
   - Application code never queries `getDb()` directly outside `scripts/lib/bare-database-allowlist.json`; all data access executes inside `withAccount(accountId, fn)` or `withPlatform(fn)`.

2. **Single-Authority Data Stores (PostgreSQL 18 + Valkey)**
   - PostgreSQL 18 is the sole relational store and `pg-boss` job broker.
   - Valkey is the sole cache and rate-limiter authority (fixed-window counters); PostgreSQL `LISTEN`/`NOTIFY` is the only realtime broker.
   - Embedded databases and in-memory production/development store fallbacks are strictly prohibited.

3. **Verified Custom Domains**
   - A custom hostname reaches `status = 'active'` only after `verifyCustomDomain` matches the `_spb-verify.<hostname>` DNS TXT token recorded in `site_domains.verification_token`. No code path may set a domain active or certificates issued without that proof.

4. **Capability-Driven Authorization**
   - Every Server Action (`"use server"`) and non-public route handler enforces authentication and explicit capability checks (`requireAccountCapability`, `requireAccountPageCapability`, `requirePlatformCapability`, `requirePlatformPageCapability`) before reading or mutating state.
   - Stealth platform admin routes live behind `ADMIN_PATH`; direct requests to `/admin` return `404` in `proxy.ts`.

5. **Privacy & Cryptographic Hygiene**
   - Guest contact details are encrypted with AES-256-GCM (`GUEST_CONTACT_KEY`) and indexed only by HMAC-SHA256 (`GUEST_LOOKUP_KEY`).
   - Only `app/server/crypto` and `app/server/privacy` may touch contact ciphertext; erasure writes an immutable `erasure_logs` tombstone replayed automatically after backup restoration (`scripts/replay-erasure-log.ts`).

6. **Design System, Localization & Code Hygiene**
   - Raw HTML primitives (`<button>`, `<input>`, `<select>`, `<textarea>`, `<label>`, `<form>`, `<table>`, `<a>`, `<dialog>`) are forbidden outside `components/ui/**`.
   - Raw Tailwind palette classes (`bg-blue-500`, `text-slate-900`, etc.) are forbidden; all styling uses semantic theme tokens verified for WCAG 2.1 AA contrast (`verify:contrast`).
   - All user-visible copy resolves through `messages/en-GB.json` and `messages/en-US.json` (`react/jsx-no-literals` + `verify:message-catalog`).
   - Source files contain zero inline or block comments (`house/no-source-comments`), zero `console.*` calls (`no-console`), and maximum cyclomatic complexity of `15`.

7. **Durable Background Work**
   - Every queue declared in `lib/enums/job-kind.ts` carries a policy in `QUEUE_POLICY_MAP` and a working handler in `app/server/jobs/handlers.ts`. A queue with no producer or no handler is deleted rather than shipped as a no-op.

8. **Container & Deployment Hardening**
   - Coolify deployments run three services (`migrate`, `web`, `worker`) pinned to `oven/bun:1.4.4-slim` as non-root `USER bun` with `read_only: true`, `cap_drop: ["ALL"]`, and `no-new-privileges:true`.
