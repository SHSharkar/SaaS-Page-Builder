import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";
import { projectFiles } from "./lib/files";

const ACTION_GUARDS = [
  "requireAccountCapability(",
  "requirePlatformCapability(",
  "requirePublicActionRateLimit(",
];

const PUBLIC_API_ALLOWLIST = new Set([
  "app/api/auth/[...all]/route.ts",
  "app/api/health/route.ts",
  "app/api/health/ready/route.ts",
  "app/api/og/route.ts",
]);

const ROUTE_GUARDS = [
  "requireAccountCapability(",
  "requirePlatformCapability(",
  "verifyHmacWebhookSignature(",
  "verifyStripeWebhookSignature(",
  "INTERNAL_TLS_CHECK_TOKEN",
];

function checkServerActionFiles(rootDir: string): string[] {
  const issues: string[] = [];
  for (const rel of projectFiles(["app"], rootDir)) {
    if (!rel.endsWith(".ts") && !rel.endsWith(".tsx")) continue;
    const text = fs.readFileSync(path.join(rootDir, rel), "utf8");
    const trimmed = text.trimStart();
    if (
      !trimmed.startsWith('"use server"') &&
      !trimmed.startsWith("'use server'")
    ) {
      continue;
    }
    if (!ACTION_GUARDS.some((guard) => text.includes(guard))) {
      issues.push(
        `${rel}: "use server" module missing capability/rate-limit guard`,
      );
    }
  }
  return issues;
}

function checkPageGuards(rootDir: string): string[] {
  const issues: string[] = [];
  for (const rel of projectFiles(["app/(app)"], rootDir)) {
    if (!rel.endsWith("/page.tsx")) continue;
    const text = fs.readFileSync(path.join(rootDir, rel), "utf8");
    if (!text.includes("requireAccountPageCapability(")) {
      issues.push(
        `${rel}: workspace page missing requireAccountPageCapability()`,
      );
    }
  }
  for (const rel of projectFiles(["app/admin"], rootDir)) {
    if (!rel.endsWith("/page.tsx")) continue;
    const text = fs.readFileSync(path.join(rootDir, rel), "utf8");
    if (
      !text.includes("requirePlatformPageCapability(") &&
      !text.includes("requireAdminConsoleSession(")
    ) {
      issues.push(`${rel}: admin page missing requirePlatformPageCapability()`);
    }
  }
  return issues;
}

function checkRouteHandlers(rootDir: string): string[] {
  const issues: string[] = [];
  for (const rel of projectFiles(["app/api", "app/webhooks"], rootDir)) {
    if (!rel.endsWith("/route.ts") || PUBLIC_API_ALLOWLIST.has(rel)) {
      continue;
    }
    const text = fs.readFileSync(path.join(rootDir, rel), "utf8");
    if (!ROUTE_GUARDS.some((guard) => text.includes(guard))) {
      issues.push(
        `${rel}: route handler missing authorization or signature guard`,
      );
    }
  }
  return issues;
}

export function verifyAuthz(rootDir = process.cwd()): CheckResult {
  const failures = [
    ...checkServerActionFiles(rootDir),
    ...checkPageGuards(rootDir),
    ...checkRouteHandlers(rootDir),
  ];

  return failures.length === 0
    ? passCheck(
        "verify:authz",
        "All Server Actions, workspace/admin pages, and API/webhook routes enforce authorization guards",
      )
    : failCheck("verify:authz", "Authorization guard check failed", failures);
}

void runCliCheck(import.meta.url, () => verifyAuthz());
