import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import { projectFiles } from "./lib/files";

function flattenKeys(node: Record<string, unknown>, prefix = ""): Set<string> {
  const keys = new Set<string>();
  for (const [k, v] of Object.entries(node)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      for (const child of flattenKeys(v as Record<string, unknown>, full)) {
        keys.add(child);
      }
    } else if (typeof v === "string") {
      keys.add(full);
    }
  }
  return keys;
}

function checkReferencedKeys(rootDir: string, enGbKeys: Set<string>): string[] {
  const issues: string[] = [];
  const callRegex = /\bt\(\s*"([a-zA-Z0-9_.]+)"/g;
  for (const rel of projectFiles(["app", "components", "hooks"], rootDir)) {
    if (
      rel.endsWith(".test.ts") ||
      rel.endsWith(".test.tsx") ||
      (!rel.endsWith(".ts") && !rel.endsWith(".tsx"))
    ) {
      continue;
    }
    const text = fs.readFileSync(path.join(rootDir, rel), "utf8");
    let match: RegExpExecArray | null = callRegex.exec(text);
    while (match) {
      const key = match[1];
      if (key && !enGbKeys.has(key)) {
        issues.push(`${rel}: missing translation key "${key}" in en-GB.json`);
      }
      match = callRegex.exec(text);
    }
  }
  return issues;
}

export function verifyMessageCatalog(rootDir = process.cwd()): CheckResult {
  const msgDir = path.join(rootDir, "messages");
  const enGb = JSON.parse(
    fs.readFileSync(path.join(msgDir, "en-GB.json"), "utf8"),
  ) as Record<string, unknown>;
  const enUs = JSON.parse(
    fs.readFileSync(path.join(msgDir, "en-US.json"), "utf8"),
  ) as Record<string, unknown>;

  const gbKeys = flattenKeys(enGb);
  const usKeys = flattenKeys(enUs);
  const failures: string[] = [];

  for (const key of gbKeys) {
    if (!usKeys.has(key)) {
      failures.push(`en-US.json missing key "${key}"`);
    }
  }
  for (const key of usKeys) {
    if (!gbKeys.has(key)) {
      failures.push(`en-GB.json missing key "${key}"`);
    }
  }

  for (const file of fs.readdirSync(msgDir)) {
    if (!file.endsWith(".json")) continue;
    JSON.parse(fs.readFileSync(path.join(msgDir, file), "utf8"));
  }

  failures.push(...checkReferencedKeys(rootDir, gbKeys));

  return failures.length === 0
    ? passCheck(
        "verify:message-catalog",
        `Verified 100% parity (${gbKeys.size} keys) between en-GB/en-US and all referenced t(...) keys`,
      )
    : failCheck(
        "verify:message-catalog",
        "Message catalog verification failed",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyMessageCatalog());
