import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { getEnv } from "@/app/server/env";
import { logger } from "@/app/server/logger";
import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;

const globalDb = globalThis as unknown as {
  __spbPgPool?: Pool | null;
  __spbDrizzle?: AppDatabase | null;
};

export function getDbPool(): Pool {
  if (globalDb.__spbPgPool) {
    return globalDb.__spbPgPool;
  }
  const { DATABASE_URL } = getEnv();
  const pool = new Pool({
    connectionString: DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 12),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: "saas-page-builder",
  });
  pool.on("error", (err) => {
    logger.error({ err: err.message }, "PostgreSQL idle client error");
  });
  globalDb.__spbPgPool = pool;
  return pool;
}

export function getDb(): AppDatabase {
  if (globalDb.__spbDrizzle) {
    return globalDb.__spbDrizzle;
  }
  const instance = drizzle(getDbPool(), { schema });
  globalDb.__spbDrizzle = instance;
  return instance;
}

export const db: AppDatabase = new Proxy({} as AppDatabase, {
  get(_target, prop) {
    const instance = getDb();
    const val = Reflect.get(instance as object, prop, instance);
    return typeof val === "function" ? val.bind(instance) : val;
  },
});

export async function closeDbPool(): Promise<void> {
  const pool = globalDb.__spbPgPool;
  globalDb.__spbPgPool = null;
  globalDb.__spbDrizzle = null;
  if (pool) {
    await pool.end();
  }
}

export async function dbPing(): Promise<boolean> {
  const res = await getDbPool().query("SELECT 1 AS ok");
  return res.rowCount === 1;
}
