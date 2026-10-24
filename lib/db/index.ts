import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

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

  rmSync(pidPath, { force: true });
}

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

async function discard(): Promise<void> {
  try {
    await g.__trofeoClient?.close();
  } catch {

  }
  g.__trofeoDb = undefined;
  g.__trofeoClient = undefined;
  rmSync(lockPath, { force: true });
}

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

export function ensureDb(): Promise<void> {

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
