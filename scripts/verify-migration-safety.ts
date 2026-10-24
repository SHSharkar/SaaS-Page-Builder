import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import {
  normalizeWhitespace,
  readMigrations,
  splitStatements,
} from "./lib/sql";

function auditStatement(tag: string, stmt: string): string | null {
  const flat = normalizeWhitespace(stmt);
  if (/^TRUNCATE\b/i.test(flat)) {
    return `${tag}: TRUNCATE is forbidden in forward migrations`;
  }
  if (
    /^DROP\s+TABLE\b/i.test(flat) &&
    !/^DROP\s+TABLE\s+IF\s+EXISTS\b/i.test(flat)
  ) {
    return `${tag}: DROP TABLE without IF EXISTS is forbidden`;
  }
  if (
    /SECURITY\s+DEFINER/i.test(flat) &&
    !/SET\s+search_path\s*=\s*public/i.test(flat)
  ) {
    return `${tag}: SECURITY DEFINER function must pin SET search_path = public`;
  }
  return null;
}

export function verifyMigrationSafety(rootDir = process.cwd()): CheckResult {
  const migrations = readMigrations(rootDir);
  const failures: string[] = [];

  for (const mig of migrations) {
    for (const stmt of splitStatements(mig.sql)) {
      const issue = auditStatement(mig.tag, stmt);
      if (issue) {
        failures.push(issue);
      }
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:migration-safety",
        "All SQL migrations satisfy forward-only safety and SECURITY DEFINER search_path rules",
      )
    : failCheck(
        "verify:migration-safety",
        "Unsafe SQL migration statement detected",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyMigrationSafety());
