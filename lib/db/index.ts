import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

/**
 * PostgreSQL, embedded. PGlite is real PostgreSQL compiled to WASM, so the
 * schema, the SQL, and the JSONB behaviour are the production ones; only the
 * transport differs. Point DATABASE_URL at a server and the same Drizzle
 * schema moves across unchanged (see README).
 */
type Db = PgliteDatabase<typeof schema>;

type Globals = {
  __trofeoClient?: PGlite;
  __trofeoDb?: Db;
  __trofeoReady?: Promise<void>;
  __trofeoSeeding?: boolean;
  __trofeoShutdownHooked?: boolean;
};

const g = globalThis as unknown as Globals;

const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pg");
const lockPath = path.join(dataDir, "arena-process.lock");
const pidPath = path.join(dataDir, "postmaster.pid");

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * PGlite keeps a `postmaster.pid` inside its data directory. A process that is
 * killed without closing the database leaves that file behind, and the next
 * start aborts on `CREATE SCHEMA` instead of recovering. We therefore record
 * our own pid: if the previous owner is gone, both files are stale and are
 * cleared before opening; if it is still alive we leave them alone, because
 * two writers on one directory is exactly what the lock is for.
 */
function clearStaleLock(): void {
  const owned = existsSync(lockPath);
  if (owned) {
    const previous = Number.parseInt(readFileSync(lockPath, "utf8").trim(), 10);
    // A live owner keeps the directory. Two writers would corrupt it.
    if (Number.isFinite(previous) && previous !== process.pid && isRunning(previous)) return;
    rmSync(lockPath, { force: true });
  }
  // No recorded owner (or a dead one): any postmaster.pid left in the tree is
  // debris from an unclean exit and would abort this start.
  rmSync(pidPath, { force: true });
}

/** A clean exit flushes PGlite's WAL; without it the data dir can be left mid-write. */
function hookShutdown(): void {
  if (g.__trofeoShutdownHooked) return;
  g.__trofeoShutdownHooked = true;
  let closing = false;
  const close = async (code: number) => {
    if (closing) return;
    closing = true;
    try {
      await g.__trofeoClient?.close();
    } catch {
      /* the process is going away either way */
    }
    rmSync(lockPath, { force: true });
    process.exit(code);
  };
  process.once("SIGTERM", () => void close(0));
  process.once("SIGINT", () => void close(0));
  process.once("beforeExit", () => rmSync(lockPath, { force: true }));
}

function client(): PGlite {
  if (!g.__trofeoClient) {
    mkdirSync(dataDir, { recursive: true });
    clearStaleLock();
    g.__trofeoClient = new PGlite(dataDir);
    writeFileSync(lockPath, String(process.pid));
    hookShutdown();
  }
  return g.__trofeoClient;
}

export const db: Db = (() => {
  if (!g.__trofeoDb) g.__trofeoDb = drizzle(client(), { schema });
  return g.__trofeoDb;
})();

/**
 * Runs the shipped migrations once per process, then the seed on an empty
 * database. Migrations are their own step in production (`npm run db:migrate`);
 * in this single-process build they run on first touch so a fresh checkout
 * boots into a working product.
 */
export function ensureDb(): Promise<void> {
  // The seed runs inside the ready promise; its own writes must not wait on it.
  if (g.__trofeoSeeding) return Promise.resolve();
  if (!g.__trofeoReady) {
    g.__trofeoReady = (async () => {
      await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
      const { seedIfEmpty } = await import("@/lib/seed");
      g.__trofeoSeeding = true;
      try {
        await seedIfEmpty();
      } finally {
        g.__trofeoSeeding = false;
      }
    })().catch((error) => {
      g.__trofeoReady = undefined;
      throw error;
    });
  }
  return g.__trofeoReady;
}

export { schema };
export type { Db };
