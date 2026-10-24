import { Client } from "pg";
import {
  resolveTestDatabaseUrl,
  resolveTestRedisUrl,
} from "./vitest.test-database";
import { applyDevelopmentEnvDefaults } from "./lib/development-env";

async function ensureDatabaseExists(connectionString: string): Promise<void> {
  const parsed = new URL(connectionString);
  const targetDb = parsed.pathname.replace(/^\//, "");
  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";

  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  try {
    const check = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [targetDb],
    );
    if (check.rowCount === 0) {
      const escaped = `"${targetDb.replace(/"/g, '""')}"`;
      await adminClient.query(`CREATE DATABASE ${escaped}`);
    }
  } finally {
    await adminClient.end();
  }
}

export default async function globalSetup(): Promise<void> {
  process.env.DATABASE_URL = resolveTestDatabaseUrl();
  process.env.REDIS_URL = resolveTestRedisUrl();
  applyDevelopmentEnvDefaults();
  await ensureDatabaseExists(process.env.DATABASE_URL);
  const { applyMigrations } = await import("./scripts/migrate");
  await applyMigrations(process.env.DATABASE_URL);
}
