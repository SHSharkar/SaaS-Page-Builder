import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";

function collectShellTargets(rootDir: string): string[] {
  const targets: string[] = [];
  const huskyDir = path.join(rootDir, ".husky");
  if (fs.existsSync(huskyDir)) {
    for (const entry of fs.readdirSync(huskyDir, { withFileTypes: true })) {
      if (entry.isFile() && !entry.name.startsWith("_")) {
        targets.push(path.join(".husky", entry.name));
      }
    }
  }
  const scriptsDir = path.join(rootDir, "scripts");
  if (fs.existsSync(scriptsDir)) {
    for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".sh")) {
        targets.push(path.join("scripts", entry.name));
      }
    }
  }
  return targets.sort();
}

export function verifyShell(rootDir = process.cwd()): CheckResult {
  const targets = collectShellTargets(rootDir);
  if (targets.length === 0) {
    return passCheck("verify:shell", "No shell scripts present");
  }
  const failures: string[] = [];

  const sc = spawnSync("shellcheck", targets, {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (sc.status !== 0) {
    failures.push(
      `shellcheck failed:\n${sc.stdout ?? ""}${sc.stderr ?? ""}`.trim(),
    );
  }

  const sf = spawnSync("shfmt", ["-d", "-i", "2", "-ci", ...targets], {
    cwd: rootDir,
    encoding: "utf8",
  });
  if (sf.status !== 0) {
    failures.push(
      `shfmt diff failed:\n${sf.stdout ?? ""}${sf.stderr ?? ""}`.trim(),
    );
  }

  return failures.length === 0
    ? passCheck(
        "verify:shell",
        `Verified ${targets.length} POSIX shell script(s) with shellcheck and shfmt`,
      )
    : failCheck("verify:shell", "Shell script lint/format failed", failures);
}

void runCliCheck(import.meta.url, () => verifyShell());
