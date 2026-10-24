import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import { projectFiles } from "./lib/files";

const SCANNED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mjs",
  ".json",
  ".md",
  ".css",
  ".yml",
]);

const LEGACY_BRAND_REGEX = /trofeo[\s-]pages/i;

export function verifyWording(
  rootDir = process.cwd(),
  fix = process.argv.includes("--fix"),
): CheckResult {
  const failures: string[] = [];
  const files = projectFiles([""], rootDir);

  for (const rel of files) {
    if (
      rel === "bun.lock" ||
      rel === "scripts/verify-wording.ts" ||
      rel === "scripts/verify.test.ts"
    ) {
      continue;
    }
    const ext = path.extname(rel);
    if (!SCANNED_EXTENSIONS.has(ext)) {
      continue;
    }
    const fullPath = path.join(rootDir, rel);
    let content = fs.readFileSync(fullPath, "utf8");

    if (fix && content.includes("\u2014")) {
      content = content.replace(/\u2014/g, "-");
      fs.writeFileSync(fullPath, content);
    }

    if (content.includes("\u2014")) {
      failures.push(`${rel}: contains forbidden em-dash (U+2014)`);
    }
    if (LEGACY_BRAND_REGEX.test(content)) {
      failures.push(`${rel}: contains legacy brand string "Trofeo Pages"`);
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:wording",
        "Zero em-dashes and zero legacy brand strings across repository",
      )
    : failCheck("verify:wording", "Wording policy violations found", failures);
}

void runCliCheck(import.meta.url, () => verifyWording());
