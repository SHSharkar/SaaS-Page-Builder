import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import { MIGRATIONS_FOLDER, readMigrations } from "./lib/sql";

export function verifyMigrations(rootDir = process.cwd()): CheckResult {
  const checksumPath = path.join(
    rootDir,
    MIGRATIONS_FOLDER,
    "meta",
    "_checksums.json",
  );
  if (!fs.existsSync(checksumPath)) {
    return failCheck(
      "verify:migrations",
      "Missing migration checksum manifest",
      [checksumPath],
    );
  }
  const checksums = JSON.parse(fs.readFileSync(checksumPath, "utf8")) as Record<
    string,
    string
  >;
  const loaded = readMigrations(rootDir);
  if (loaded.length === 0) {
    return failCheck(
      "verify:migrations",
      "No migrations registered in journal",
      [],
    );
  }

  const failures: string[] = [];
  for (const mig of loaded) {
    if (mig.sql.trim().length === 0) {
      failures.push(`${mig.tag}: SQL file is empty`);
      continue;
    }
    const actual = crypto
      .createHash("sha256")
      .update(mig.sql, "utf8")
      .digest("hex");
    const expected = checksums[mig.tag];
    if (expected !== actual) {
      failures.push(
        `${mig.tag}: SHA-256 mismatch (expected ${expected ?? "missing"}, actual ${actual})`,
      );
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:migrations",
        `Verified ${loaded.length} migration(s) and SHA-256 checksums`,
      )
    : failCheck(
        "verify:migrations",
        "Migration integrity check failed",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyMigrations());
