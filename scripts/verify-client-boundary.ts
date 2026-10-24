import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import { projectFiles } from "./lib/files";

const FORBIDDEN_SERVER_MODULES = [
  "server-only",
  "pg",
  "pg-boss",
  "ioredis",
  "pino",
  "nodemailer",
  "@node-rs/argon2",
];

function findImports(source: string): string[] {
  const specs: string[] = [];
  const regex = /(?:from|import)\s+["']([^"']+)["']/g;
  let match: RegExpExecArray | null = regex.exec(source);
  while (match) {
    if (match[1]) {
      specs.push(match[1]);
    }
    match = regex.exec(source);
  }
  return specs;
}

function isClientCheckedFile(rel: string, content: string): boolean {
  if (rel.startsWith("lib/") || rel.startsWith("hooks/")) {
    return true;
  }
  const trimmed = content.trimStart();
  return (
    trimmed.startsWith('"use client"') || trimmed.startsWith("'use client'")
  );
}

function checkSpecAllowed(rel: string, spec: string): string | null {
  if (FORBIDDEN_SERVER_MODULES.includes(spec)) {
    return `${rel}: client/shared module imports server package "${spec}"`;
  }
  if (spec.startsWith("@/app/server/") && !spec.endsWith("/actions")) {
    return `${rel}: client module imports non-action server module "${spec}"`;
  }
  return null;
}

export function verifyClientBoundary(rootDir = process.cwd()): CheckResult {
  const failures: string[] = [];
  const files = projectFiles(["app", "components", "hooks", "lib"], rootDir);

  for (const rel of files) {
    if (
      rel.endsWith(".test.ts") ||
      rel.endsWith(".test.tsx") ||
      (!rel.endsWith(".ts") && !rel.endsWith(".tsx"))
    ) {
      continue;
    }
    const text = fs.readFileSync(path.join(rootDir, rel), "utf8");
    if (!isClientCheckedFile(rel, text)) {
      continue;
    }
    for (const spec of findImports(text)) {
      const err = checkSpecAllowed(rel, spec);
      if (err) failures.push(err);
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:client-boundary",
        "All client components, hooks, and lib modules preserve strict server/client boundaries",
      )
    : failCheck(
        "verify:client-boundary",
        "Client boundary violations detected",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyClientBoundary());
