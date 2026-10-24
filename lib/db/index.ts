import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
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
 * start aborts instead of recovering. We therefore record our own pid: if the
 * previous owner is gone, both files are stale and are cleared before opening;
 * if it is still alive we refuse, because two writers on one directory is
 * exactly what the lock is for.
 */
function clearStaleLock(): void {
  if (existsSync(lockPath)) {
    const previous = Number.parseInt(readFileSync(lockPath, "utf8").trim(), 10);
    if (Number.isFinite(previous) && previous !== process.pid && isRunning(previous)) {
      throw new Error(
        `The database at ${dataDir} is open in process ${previous}. ` +
          "Stop that process (the dev server) before opening it here.",
      );
    }
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

function open(): Db {
  mkdirSync(dataDir, { recursive: true });
  clearStaleLock();
  g.__trofeoClient = new PGlite(dataDir);
  const instance = drizzle(g.__trofeoClient, { schema });
  writeFileSync(lockPath, String(process.pid));
  hookShutdown();
  return instance;
}

/** Forgets the current handle so the next touch opens the directory again. */
async function discard(): Promise<void> {
  try {
    await g.__trofeoClient?.close();
  } catch {
    /* already gone */
  }
  g.__trofeoDb = undefined;
  g.__trofeoClient = undefined;
  rmSync(lockPath, { force: true });
}

/**
 * `db` is a thin proxy rather than a captured handle so a wedged database can
 * be replaced without the hundred modules that import it caring. Everything
 * else in the app talks to this object exactly as before.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, property) {
    if (!g.__trofeoDb) g.__trofeoDb = open();
    const instance = g.__trofeoDb;
    const value = Reflect.get(instance as object, property, instance) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
  has(_target, property) {
    if (!g.__trofeoDb) g.__trofeoDb = open();
    return Reflect.has(g.__trofeoDb as object, property);
  },
});

function looksCorrupt(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /Aborted\(\)|database is starting up|could not open file|invalid checkpoint/i.test(message);
}

/**
 * Moves an unreadable directory aside so the next start is clean, and says so
 * loudly. The alternative — a dev server that refuses to boot every time it was
 * killed mid-write — is worse for a demo build whose data is reproducible from
 * the seed.
 */
function quarantine(): string {
  const aside = `${dataDir}.unreadable-${Date.now()}`;
  try {
    renameSync(dataDir, aside);
  } catch {
    rmSync(dataDir, { recursive: true, force: true });
  }
  return aside;
}

async function migrateAndSeed(): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  const { seedIfEmpty } = await import("@/lib/seed");
  g.__trofeoSeeding = true;
  try {
    await seedIfEmpty();
  } finally {
    g.__trofeoSeeding = false;
  }
}

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
      try {
        await migrateAndSeed();
      } catch (error) {
        if (!looksCorrupt(error) || process.env.PGLITE_AUTO_RECOVER === "false") throw error;
        const aside = quarantine();
        await discard();
        console.warn(
          `[db] PGlite could not read ${dataDir} (unclean shutdown). The old directory was kept at ${aside}; ` +
            "a fresh database has been created and seeded.",
        );
        await migrateAndSeed();
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
