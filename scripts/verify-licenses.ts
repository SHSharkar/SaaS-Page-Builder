import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";

const FORBIDDEN_LICENSE_PREFIXES = ["AGPL", "GPL-", "SSPL"];

function collectPackageJsonPaths(nmDir: string): string[] {
  if (!fs.existsSync(nmDir)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(nmDir, entry.name);
    if (entry.name.startsWith("@") && entry.isDirectory()) {
      for (const sub of fs.readdirSync(full, { withFileTypes: true })) {
        const pkgPath = path.join(full, sub.name, "package.json");
        if (fs.existsSync(pkgPath)) results.push(pkgPath);
      }
    } else {
      const pkgPath = path.join(full, "package.json");
      if (fs.existsSync(pkgPath)) results.push(pkgPath);
    }
  }
  return results;
}

function extractLicenseString(pkg: Record<string, unknown>): string {
  if (typeof pkg.license === "string") {
    return pkg.license.trim().toUpperCase();
  }
  if (pkg.license && typeof pkg.license === "object") {
    const t = (pkg.license as { type?: unknown }).type;
    return typeof t === "string" ? t.trim().toUpperCase() : "";
  }
  return "";
}

export function verifyLicenses(rootDir = process.cwd()): CheckResult {
  const pkgPaths = collectPackageJsonPaths(path.join(rootDir, "node_modules"));
  const failures: string[] = [];

  for (const pkgPath of pkgPaths) {
    const raw = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<
      string,
      unknown
    >;
    const name = typeof raw.name === "string" ? raw.name : pkgPath;
    const lic = extractLicenseString(raw);
    if (
      !lic ||
      lic.includes("MIT") ||
      lic.includes("APACHE") ||
      lic.includes("BSD") ||
      lic.includes("ISC")
    ) {
      continue;
    }
    if (FORBIDDEN_LICENSE_PREFIXES.some((prefix) => lic.startsWith(prefix))) {
      failures.push(`${name}: forbidden copyleft license "${lic}"`);
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:licenses",
        `Scanned ${pkgPaths.length} installed packages with zero forbidden copyleft licenses`,
      )
    : failCheck(
        "verify:licenses",
        "Forbidden package licenses detected",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyLicenses());
