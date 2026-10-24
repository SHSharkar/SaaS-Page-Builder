import fs from "node:fs";
import path from "node:path";

const IGNORED_DIRS = new Set([
  ".git",
  ".next",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
  ".verify-logs",
]);

function walkDirectory(rootDir: string, relDir = ""): string[] {
  const full = path.join(rootDir, relDir);
  if (!fs.existsSync(full)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) {
      continue;
    }
    const childRel = relDir ? `${relDir}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      out.push(...walkDirectory(rootDir, childRel));
    } else if (entry.isFile()) {
      out.push(childRel);
    }
  }
  return out;
}

export function projectFiles(
  prefixes: readonly string[] = [""],
  rootDir = process.cwd(),
): string[] {
  const all = walkDirectory(rootDir);
  const filtered = all.filter((rel) =>
    prefixes.some((p) => p === "" || rel === p || rel.startsWith(`${p}/`)),
  );
  return filtered.sort();
}

export function tryReadTextFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}
