import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import { projectFiles } from "./lib/files";

const ALLOWED_DELETE_FILES = new Set([
  "app/server/privacy/index.ts",
  "app/server/sweeper/index.ts",
  "scripts/purge-keep-window.ts",
  "scripts/replay-erasure-log.ts",
  "app/server/test-support/index.ts",
]);

const DRIZZLE_DELETE_REGEX = /\b(?:tx|db)\.delete\s*\(/;
const SQL_DELETE_REGEX = /\bDELETE\s+FROM\s+[a-z_]+/i;

export function verifyTenantDelete(rootDir = process.cwd()): CheckResult {
  const failures: string[] = [];

  for (const rel of projectFiles(
    ["app", "components", "hooks", "lib", "scripts"],
    rootDir,
  )) {
    if (
      ALLOWED_DELETE_FILES.has(rel) ||
      rel.endsWith(".test.ts") ||
      rel.endsWith(".test.tsx") ||
      rel === "scripts/verify-tenant-delete.ts"
    ) {
      continue;
    }
    if (!rel.endsWith(".ts") && !rel.endsWith(".tsx")) {
      continue;
    }
    const text = fs.readFileSync(path.join(rootDir, rel), "utf8");
    if (DRIZZLE_DELETE_REGEX.test(text) || SQL_DELETE_REGEX.test(text)) {
      failures.push(
        `${rel}: hard DELETE detected outside privacy, sweeper, and purge-keep-window modules`,
      );
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:tenant-delete",
        "Hard DELETE operations are confined strictly to privacy erasure and keep-window sweeper modules",
      )
    : failCheck(
        "verify:tenant-delete",
        "Forbidden hard DELETE detected",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyTenantDelete());
