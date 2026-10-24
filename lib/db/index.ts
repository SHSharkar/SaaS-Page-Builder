import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { Pool } from "pg";
import { drizzle as drizzleNodePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate as migrateNodePg } from "drizzle-orm/node-postgres/migrator";
import type { PGlite } from "@electric-sql/pglite";
import * as schema from "./schema";
import { logger } from "@/lib/logger";

export type Database = NodePgDatabase<typeof schema>;

type DbRuntime = {
  db?: Database;
  pool?: Pool;
  pglite?: PGlite;
  ready?: Promise<void>;
  bootstrapping?: boolean;
  backend?: "postgres" | "pglite";
};

const runtime = globalThis as unknown as { __trofeoDbRuntime?: DbRuntime };

function state(): DbRuntime {
  if (!runtime.__trofeoDbRuntime) {
    runtime.__trofeoDbRuntime = {};
  }
  return runtime.__trofeoDbRuntime;
}

export function databaseBackend(): "postgres" | "pglite" {
  if (process.env.DATABASE_URL?.trim()) {
    return "postgres";
  }
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.ALLOW_EMBEDDED_DB !== "true"
  ) {
    throw new Error("DATABASE_URL is required in production.");
  }
  return "pglite";
}

function createPgPool(): Pool {
  const current = state();
  if (current.pool) return current.pool;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const pool = new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "trofeo-pages",
  });
  pool.on("error", (err) => {
    logger.error({ err }, "Unexpected PostgreSQL pool idle client error");
  });
  current.pool = pool;
  current.backend = "postgres";
  return pool;
}

async function createPgliteInstance(): Promise<{ db: Database; pglite: PGlite }> {
  const current = state();
  if (current.pglite && current.db) {
    return { db: current.db, pglite: current.pglite };
  }
  const [{ PGlite: PGliteClass }, { drizzle: drizzlePglite }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("drizzle-orm/pglite"),
  ]);
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pg");
  if (dir !== "memory://") {
    mkdirSync(dir, { recursive: true });
  }
  const pglite = new PGliteClass(dir);
  const instance = drizzlePglite(pglite, { schema }) as unknown as Database;
  current.pglite = pglite;
  current.db = instance;
  current.backend = "pglite";
  return { db: instance, pglite };
}

function getSyncOrInitDb(): Database {
  const current = state();
  if (current.db) return current.db;
  if (databaseBackend() === "postgres") {
    const pool = createPgPool();
    current.db = drizzleNodePg(pool, { schema });
    return current.db;
  }
  throw new Error("Call ensureDb() before issuing queries on the local test database.");
}

export const db: Database = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = getSyncOrInitDb();
    const value = Reflect.get(instance as object, prop, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});

export function getPgPool(): Pool | null {
  return state().pool ?? null;
}

export function getPgliteInstance(): PGlite | null {
  return state().pglite ?? null;
}

export async function runMigrations(): Promise<Database> {
  const current = state();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (databaseBackend() === "postgres") {
    const pool = createPgPool();
    current.db = drizzleNodePg(pool, { schema });
    await migrateNodePg(current.db, { migrationsFolder });
  } else {
    const { db: pgliteDb } = await createPgliteInstance();
    const { migrate: migratePglite } = await import("drizzle-orm/pglite/migrator");
    await migratePglite(pgliteDb as never, { migrationsFolder });
  }
  return current.db!;
}

export async function ensureDb(): Promise<Database> {
  const current = state();
  if (current.bootstrapping && current.db) {
    return current.db;
  }
  if (!current.ready) {
    current.ready = (async () => {
      const backend = databaseBackend();
      if (backend === "postgres") {
        const pool = createPgPool();
        current.db = drizzleNodePg(pool, { schema });
        return;
      }
      await runMigrations();
      current.bootstrapping = true;
      try {
        const [{ syncComponentCatalog }, { seedIfEmpty }] = await Promise.all([
          import("@/lib/registry/sync"),
          import("@/lib/seed"),
        ]);
        await syncComponentCatalog();
        await seedIfEmpty();
      } finally {
        current.bootstrapping = false;
      }
    })().catch((err) => {
      current.bootstrapping = false;
      current.ready = undefined;
      throw err;
    });
  }
  await current.ready;
  return state().db!;
}

export async function closeDb(): Promise<void> {
  const current = state();
  if (current.pool) {
    await current.pool.end();
    current.pool = undefined;
  }
  if (current.pglite) {
    await current.pglite.close();
    current.pglite = undefined;
  }
  current.db = undefined;
  current.ready = undefined;
}

export { schema };
