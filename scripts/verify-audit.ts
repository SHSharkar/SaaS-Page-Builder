import { spawnSync } from "node:child_process";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";

export function verifyAudit(): CheckResult {
  const proc = spawnSync("bun", ["audit"], {
    encoding: "utf8",
  });
  const combined = `${proc.stdout ?? ""}\n${proc.stderr ?? ""}`;
  if (proc.status !== 0) {
    return failCheck(
      "verify:audit",
      "Dependency vulnerability audit reported advisories",
      combined
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 20),
    );
  }
  return passCheck(
    "verify:audit",
    "bun audit reported 0 known security vulnerabilities",
  );
}

void runCliCheck(import.meta.url, () => verifyAudit());
