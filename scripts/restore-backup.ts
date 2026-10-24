import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { closeDbPool } from "../app/server/db/client";
import { getEnv } from "../app/server/env";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";
import { decryptBackupEnvelope } from "./decrypt-backup";
import { replayErasureLog } from "./replay-erasure-log";

export interface RestoreRequest {
  readonly dumpPath: string;
  readonly databaseUrl: string;
  readonly encrypted: boolean;
  readonly skipErasureReplay: boolean;
}

export interface RestorePlan {
  readonly sqlPath: string;
  readonly databaseUrl: string;
  readonly skipErasureReplay: boolean;
}

export const RESTORE_USAGE =
  "Usage: bun scripts/restore-backup.ts --file <dump.sql|dump.sql.age> [--plain] [--database-url <url>] [--skip-erasure-replay]";

export function parseRestoreArgs(
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>> = process.env,
): RestoreRequest {
  let dumpPath = "";
  let databaseUrl = env.DATABASE_URL ?? "";
  let plain = false;
  let skipErasureReplay = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--file") {
      dumpPath = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--database-url") {
      databaseUrl = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--plain") {
      plain = true;
    } else if (arg === "--skip-erasure-replay") {
      skipErasureReplay = true;
    }
  }

  if (!dumpPath) {
    throw new Error(RESTORE_USAGE);
  }
  if (!databaseUrl) {
    throw new Error(`${RESTORE_USAGE}\nDATABASE_URL is required`);
  }
  return {
    dumpPath,
    databaseUrl,
    encrypted: !plain,
    skipErasureReplay,
  };
}

export function planRestore(
  request: RestoreRequest,
  workDir = path.dirname(request.dumpPath),
): RestorePlan {
  if (!fs.existsSync(request.dumpPath)) {
    throw new Error(`Backup file not found: ${request.dumpPath}`);
  }
  const sqlPath = request.encrypted
    ? path.join(workDir, `${path.basename(request.dumpPath)}.sql`)
    : request.dumpPath;
  return {
    sqlPath,
    databaseUrl: request.databaseUrl,
    skipErasureReplay: request.skipErasureReplay,
  };
}

export function materializeDump(
  request: RestoreRequest,
  plan: RestorePlan,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  if (!request.encrypted) {
    return;
  }
  const key = env.BACKUP_ENCRYPTION_KEY ?? getEnv().BACKUP_ENCRYPTION_KEY;
  const plaintext = decryptBackupEnvelope(
    fs.readFileSync(request.dumpPath, "utf8"),
    key,
  );
  fs.writeFileSync(plan.sqlPath, plaintext, "utf8");
}

export function applyDump(plan: RestorePlan): void {
  const res = spawnSync("psql", [plan.databaseUrl, "--file", plan.sqlPath], {
    stdio: "inherit",
  });
  if (res.error) {
    throw new Error(
      `psql could not run: ${res.error.message}. Install the PostgreSQL client before restoring.`,
    );
  }
  if (res.status !== 0) {
    throw new Error(`psql exited with status ${res.status ?? "unknown"}`);
  }
}

if (isMainModule(import.meta.url)) {
  void (async () => {
    const request = parseRestoreArgs(process.argv.slice(2));
    const plan = planRestore(request);
    materializeDump(request, plan);
    applyDump(plan);
    const purged = plan.skipErasureReplay ? 0 : await replayErasureLog();
    await closeDbPool();
    log.success(
      `Restore complete from ${path.basename(request.dumpPath)} (${purged} erased contact rows re-purged)`,
    );
  })().catch(async (err: unknown) => {
    await closeDbPool();
    log.failed(err instanceof Error ? err.message : "Restore failed");
    process.exit(1);
  });
}
