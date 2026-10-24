import fs from "node:fs";
import path from "node:path";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";

export interface GateStepRecord {
  readonly id: string;
  readonly command: string;
  readonly durationMs: number;
  readonly ok: boolean;
}

export interface GateLogEntry {
  readonly finishedAt: string;
  readonly trigger: string;
  readonly tier: string;
  readonly ok: boolean;
  readonly records: readonly GateStepRecord[];
}

export const DEFAULT_SHOWN_ENTRIES = 10;

export function defaultLogDir(cwd = process.cwd()): string {
  return path.join(cwd, ".verify-logs");
}

export function latestPlanPath(cwd = process.cwd()): string {
  return path.join(defaultLogDir(cwd), "latest.json");
}

export function historyPath(cwd = process.cwd()): string {
  return path.join(defaultLogDir(cwd), "history.jsonl");
}

function isStepRecord(value: unknown): value is GateStepRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.command === "string" &&
    typeof record.durationMs === "number" &&
    typeof record.ok === "boolean"
  );
}

export function isEntry(value: unknown): value is GateLogEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.finishedAt === "string" &&
    typeof entry.trigger === "string" &&
    typeof entry.tier === "string" &&
    typeof entry.ok === "boolean" &&
    Array.isArray(entry.records) &&
    entry.records.every(isStepRecord)
  );
}

export function appendEntry(
  entry: GateLogEntry,
  logPath = historyPath(),
): void {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, "utf8");
}

export function readEntries(logPath = historyPath()): GateLogEntry[] {
  if (!fs.existsSync(logPath)) {
    return [];
  }
  const entries: GateLogEntry[] = [];
  for (const line of fs.readFileSync(logPath, "utf8").split("\n")) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(line);
      if (isEntry(parsed)) {
        entries.push(parsed);
      }
    } catch {
      continue;
    }
  }
  return entries;
}

export function formatEntry(entry: GateLogEntry): string {
  const status = entry.ok ? "pass" : "fail";
  const total = entry.records.reduce(
    (sum, record) => sum + record.durationMs,
    0,
  );
  const failures = entry.records
    .filter((record) => !record.ok)
    .map((record) => record.id)
    .join(", ");
  const suffix = failures ? ` (failed: ${failures})` : "";
  return `${entry.finishedAt} ${status} tier=${entry.tier} trigger=${entry.trigger} checks=${entry.records.length} total=${total}ms${suffix}`;
}

export function shownEntries(
  entries: readonly GateLogEntry[],
  limit = DEFAULT_SHOWN_ENTRIES,
): GateLogEntry[] {
  if (limit <= 0) {
    return [];
  }
  return entries.slice(-limit);
}

function parseLimit(args: readonly string[]): number | null {
  if (args.includes("--all")) {
    return Number.POSITIVE_INFINITY;
  }
  const index = args.findIndex((arg) => arg === "--limit");
  if (index === -1) {
    return DEFAULT_SHOWN_ENTRIES;
  }
  const raw = args[index + 1];
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

if (isMainModule(import.meta.url)) {
  const limit = parseLimit(process.argv.slice(2));
  if (limit === null) {
    log.failed("usage: bun run verify:log [--limit N] [--all]");
    process.exit(2);
  }
  const entries = readEntries();
  if (entries.length === 0) {
    log.info(`No gate runs recorded at ${historyPath()}`);
  } else {
    for (const entry of shownEntries(entries, limit)) {
      process.stdout.write(`${formatEntry(entry)}\n`);
    }
  }
}
