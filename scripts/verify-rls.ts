import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import { projectFiles } from "./lib/files";
import {
  buildSchemaModel,
  isTenantTable,
  type TableModel,
} from "./lib/schema-model";

function auditTenantTableRls(table: TableModel): string[] {
  const issues: string[] = [];
  if (!table.rlsEnabled) {
    issues.push(`${table.name}: missing ENABLE ROW LEVEL SECURITY`);
  }
  if (!table.rlsForced) {
    issues.push(`${table.name}: missing FORCE ROW LEVEL SECURITY`);
  }
  const policy = table.policies.get("account_isolation");
  if (!policy) {
    issues.push(`${table.name}: missing CREATE POLICY account_isolation`);
  } else if (
    !policy.usingExpr.includes("app.account_id") ||
    !policy.checkExpr.includes("app.account_id")
  ) {
    issues.push(`${table.name}: account_isolation must check app.account_id`);
  }
  return issues;
}

function auditBareDbImports(rootDir: string): string[] {
  const allowlistPath = path.join(
    rootDir,
    "scripts",
    "lib",
    "bare-database-allowlist.json",
  );
  const parsed = JSON.parse(fs.readFileSync(allowlistPath, "utf8")) as {
    allowedFiles: string[];
  };
  const allowed = new Set(parsed.allowedFiles);
  const issues: string[] = [];

  for (const rel of projectFiles(
    ["app", "components", "hooks", "lib", "scripts"],
    rootDir,
  )) {
    if (
      rel === "scripts/verify-rls.ts" ||
      allowed.has(rel) ||
      (!rel.endsWith(".ts") && !rel.endsWith(".tsx"))
    ) {
      continue;
    }
    const content = fs.readFileSync(path.join(rootDir, rel), "utf8");
    if (
      content.includes("@/app/server/db/client") ||
      content.includes("../db/client") ||
      (content.includes("./client") && rel.startsWith("app/server/db/"))
    ) {
      issues.push(
        `${rel}: imports bare db client outside bare-database-allowlist.json (use withAccount or withPlatform)`,
      );
    }
  }
  return issues;
}

export function verifyRls(rootDir = process.cwd()): CheckResult {
  const model = buildSchemaModel(rootDir);
  const tenantTables = [...model.values()].filter(isTenantTable);
  const failures: string[] = [];

  if (tenantTables.length === 0) {
    failures.push("No tenant tables with account_id found in schema model");
  }
  for (const table of tenantTables) {
    failures.push(...auditTenantTableRls(table));
  }
  failures.push(...auditBareDbImports(rootDir));

  return failures.length === 0
    ? passCheck(
        "verify:rls",
        `Verified forced RLS on ${tenantTables.length} tenant tables and bare-db allowlist boundaries`,
      )
    : failCheck(
        "verify:rls",
        "Row-Level Security verification failed",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyRls());
