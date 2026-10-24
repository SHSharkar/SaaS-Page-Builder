import { bootstrapEnv } from "../app/server/bootstrap-env";
import { closeDbPool, dbPing, getDbPool } from "../app/server/db/client";
import { closeRedisClient, valkeyPing } from "../app/server/redis/client";
import {
  type CheckResult,
  failCheck,
  isMainModule,
  passCheck,
} from "./lib/check";
import { log } from "./lib/log";
import { buildSchemaModel, isTenantTable } from "./lib/schema-model";

export async function runPreflight(): Promise<CheckResult> {
  bootstrapEnv();
  const failures: string[] = [];

  const pgOk = await dbPing().catch(() => false);
  if (!pgOk) {
    failures.push("PostgreSQL connectivity check failed");
  }

  const redisOk = await valkeyPing().catch(() => false);
  if (!redisOk) {
    failures.push("Valkey connectivity check failed");
  }

  if (pgOk) {
    const tenantNames = [...buildSchemaModel().values()]
      .filter(isTenantTable)
      .map((t) => t.name);
    const res = await getDbPool().query<{
      relforcerowsecurity: boolean;
      relname: string;
      relrowsecurity: boolean;
    }>(
      "SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname = ANY($1::text[])",
      [tenantNames],
    );
    const byName = new Map(res.rows.map((r) => [r.relname, r]));
    for (const tableName of tenantNames) {
      const live = byName.get(tableName);
      if (!live || !live.relrowsecurity || !live.relforcerowsecurity) {
        failures.push(
          `Live PostgreSQL table "${tableName}" does not have forced RLS enabled`,
        );
      }
    }
  }

  return failures.length === 0
    ? passCheck(
        "preflight",
        "Validated environment, PostgreSQL 18 forced RLS, and Valkey readiness",
      )
    : failCheck("preflight", "Runtime preflight failed", failures);
}

if (isMainModule(import.meta.url)) {
  void runPreflight()
    .then(async (result) => {
      await closeDbPool();
      await closeRedisClient();
      if (!result.ok) {
        log.failed(`${result.name}: ${result.summary}`);
        for (const item of result.details) {
          process.stderr.write(`  - ${item}\n`);
        }
        process.exit(1);
      }
      log.success(`${result.name}: ${result.summary}`);
    })
    .catch(async (err: unknown) => {
      await closeDbPool();
      await closeRedisClient();
      log.failed(err instanceof Error ? err.message : "Preflight crashed");
      process.exit(1);
    });
}
