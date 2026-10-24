import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { mkdirSync } from "node:fs";
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
};

const g = globalThis as unknown as Globals;

const dataDir = process.env.PGLITE_DIR ?? path.join(process.cwd(), "data", "pg");

function client(): PGlite {
  if (!g.__trofeoClient) {
    mkdirSync(dataDir, { recursive: true });
    g.__trofeoClient = new PGlite(dataDir);
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
