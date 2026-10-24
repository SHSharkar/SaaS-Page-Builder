import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";
import { planGateSteps } from "./verify-plan";
import { classifyVerifyTier } from "./verify-tier";

export interface StepLogRecord {
  readonly id: string;
  readonly command: string;
  readonly durationMs: number;
  readonly ok: boolean;
}

function detectChangedFiles(): string[] {
  const res = spawnSync("git", ["diff", "--name-only", "HEAD"], {
    encoding: "utf8",
  });
  if (res.status !== 0 || !res.stdout) {
    return [];
  }
  return res.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function runVerifyGate(
  trigger = process.env.VERIFY_TRIGGER ?? "manual",
): { ok: boolean; records: StepLogRecord[] } {
  const tier = classifyVerifyTier(detectChangedFiles(), trigger);
  const steps = planGateSteps(tier);
  const logDir = path.join(process.cwd(), ".verify-logs");
  fs.mkdirSync(logDir, { recursive: true });

  log.info(`Running verify gate tier="${tier}" (${steps.length} checks)`);
  const records: StepLogRecord[] = [];

  for (const step of steps) {
    const started = Date.now();
    log.info(`[${step.id}] ${step.command}`);
    const proc = spawnSync("sh", ["-c", step.command], {
      stdio: "inherit",
      env: process.env,
    });
    const ok = proc.status === 0;
    records.push({
      id: step.id,
      command: step.command,
      durationMs: Date.now() - started,
      ok,
    });
    if (!ok) {
      fs.writeFileSync(
        path.join(logDir, "latest.json"),
        JSON.stringify({ tier, ok: false, records }, null, 2),
      );
      log.failed(`Gate halted at step "${step.id}"`);
      return { ok: false, records };
    }
  }

  fs.writeFileSync(
    path.join(logDir, "latest.json"),
    JSON.stringify({ tier, ok: true, records }, null, 2),
  );
  log.success(`All ${records.length} gate checks passed (tier="${tier}")`);
  return { ok: true, records };
}

if (isMainModule(import.meta.url)) {
  const outcome = runVerifyGate();
  if (!outcome.ok) {
    process.exit(1);
  }
}
