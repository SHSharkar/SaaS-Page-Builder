import { pathToFileURL } from "node:url";
import { log } from "./log";

export interface CheckResult {
  readonly name: string;
  readonly ok: boolean;
  readonly summary: string;
  readonly details: readonly string[];
}

export function passCheck(name: string, summary: string): CheckResult {
  return { name, ok: true, summary, details: [] };
}

export function failCheck(
  name: string,
  summary: string,
  details: readonly string[],
): CheckResult {
  return { name, ok: false, summary, details };
}

export function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return pathToFileURL(entry).href === metaUrl;
}

export async function runCliCheck(
  metaUrl: string,
  fn: () => CheckResult | Promise<CheckResult>,
): Promise<void> {
  if (!isMainModule(metaUrl)) {
    return;
  }
  const result = await fn();
  if (result.ok) {
    log.success(`${result.name}: ${result.summary}`);
    return;
  }
  log.failed(`${result.name}: ${result.summary}`);
  for (const detail of result.details) {
    process.stderr.write(`  - ${detail}\n`);
  }
  process.exit(1);
}
