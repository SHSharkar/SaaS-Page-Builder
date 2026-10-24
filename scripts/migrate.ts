import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { log } from "./lib/log";
import {
  MIGRATIONS_FOLDER,
  splitStatements,
  type MigrationJournalEntry,
} from "./lib/sql";

export const LOCK_TIMEOUT_RETRIES = 4;
const ADVISORY_LOCK_KEY = 918_273_645;

export function lockTimeoutDelayMs(attempt: number): number {
  return Math.min(2_000, 150 * 2 ** Math.max(0, attempt - 1));
}

export function describeMigrationError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function orphanedRecordMessage(
  count: number,
  tableCount: number,
): string {
  return `Found ${count} recorded migrations in drizzle.__drizzle_migrations while public schema has ${tableCount} tables`;
}

function readJournal(rootDir: string): MigrationJournalEntry[] {
  const journalPath = path.join(
    rootDir,
    MIGRATIONS_FOLDER,
    "meta",
    "_journal.json",
  );
  const parsed = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: MigrationJournalEntry[];
  };
  return parsed.entries;
}

export function journalProblems(
  entries: readonly MigrationJournalEntry[],
  rootDir = process.cwd(),
): string[] {
  const problems: string[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    const entry = entries[i];
    if (!entry) {
      continue;
    }
    if (entry.idx !== i) {
      problems.push(`Journal index mismatch at ${entry.tag}: expected ${i}`);
    }
    const sqlPath = path.join(rootDir, MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      problems.push(`Missing SQL file for journal entry ${entry.tag}`);
    }
  }
  return problems;
}

export async function withLockTimeoutRetry<T>(
  work: () => Promise<T>,
  retries = LOCK_TIMEOUT_RETRIES,
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await work();
    } catch (error) {
      attempt += 1;
      const code = (error as { code?: string } | null)?.code;
      if (code !== "55P03" || attempt > retries) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, lockTimeoutDelayMs(attempt)),
      );
    }
  }
}

async function acquireAdvisoryLock(client: Client): Promise<void> {
  await withLockTimeoutRetry(async () => {
    await client.query("SELECT pg_advisory_lock($1)", [ADVISORY_LOCK_KEY]);
  });
}

async function appliedCount(client: Client): Promise<number> {
  const res = await client.query<{ total: string }>(
    "SELECT count(*)::text AS total FROM drizzle.__drizzle_migrations",
  );
  return Number(res.rows[0]?.total ?? "0");
}

async function publicTableCount(client: Client): Promise<number> {
  const res = await client.query<{ total: string }>(
    "SELECT count(*)::text AS total FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  );
  return Number(res.rows[0]?.total ?? "0");
}

async function recordedHashes(client: Client): Promise<Set<string>> {
  const res = await client.query<{ hash: string }>(
    "SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id ASC",
  );
  return new Set(res.rows.map((r) => r.hash));
}

function staleMigrationProblems(
  appliedHashes: ReadonlySet<string>,
  expectedHashes: readonly string[],
): string[] {
  const expectedSet = new Set(expectedHashes);
  const issues: string[] = [];
  for (const existing of appliedHashes) {
    if (!expectedSet.has(existing)) {
      issues.push(`Database contains unrecognised migration hash ${existing}`);
    }
  }
  return issues;
}

export async function applyMigrations(
  connectionString = process.env.DATABASE_URL,
  rootDir = process.cwd(),
): Promise<{ applied: number; total: number }> {
  if (!connectionString || connectionString.trim().length === 0) {
    throw new Error("DATABASE_URL is required to apply migrations");
  }
  const entries = readJournal(rootDir);
  const problems = journalProblems(entries, rootDir);
  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await acquireAdvisoryLock(client);
    await client.query("CREATE SCHEMA IF NOT EXISTS drizzle");
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint NOT NULL
      )
    `);

    const countBefore = await appliedCount(client);
    const tablesBefore = await publicTableCount(client);
    if (countBefore > 0 && tablesBefore === 0) {
      throw new Error(orphanedRecordMessage(countBefore, tablesBefore));
    }

    const migrations = entries.map((entry) => {
      const sqlPath = path.join(rootDir, MIGRATIONS_FOLDER, `${entry.tag}.sql`);
      const sqlText = fs.readFileSync(sqlPath, "utf8");
      const hash = crypto
        .createHash("sha256")
        .update(sqlText, "utf8")
        .digest("hex");
      return { entry, sqlText, hash };
    });

    const existing = await recordedHashes(client);
    const stale = staleMigrationProblems(
      existing,
      migrations.map((m) => m.hash),
    );
    if (stale.length > 0) {
      throw new Error(stale.join("; "));
    }

    let newlyApplied = 0;
    for (const mig of migrations) {
      if (existing.has(mig.hash)) {
        continue;
      }
      await client.query("BEGIN");
      try {
        for (const stmt of splitStatements(mig.sqlText)) {
          await client.query(stmt);
        }
        await client.query(
          "INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)",
          [mig.hash, mig.entry.when],
        );
        await client.query("COMMIT");
        newlyApplied += 1;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      }
    }

    await client
      .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY])
      .catch(() => undefined);

    return { applied: newlyApplied, total: migrations.length };
  } finally {
    await client.end();
  }
}

if (import.meta.main) {
  applyMigrations()
    .then(({ applied, total }) => {
      log.success(`Migrations ready (${applied} applied, ${total} total)`);
    })
    .catch((err: unknown) => {
      log.failed(describeMigrationError(err));
      process.exit(1);
    });
}
