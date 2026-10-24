import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";
import { changedFiles, planGateSteps } from "./verify-plan";
import {
  type GateLogEntry,
  type GateStepRecord,
  appendEntry,
  latestPlanPath,
} from "./verify-log";
import { classifyVerifyTier, type VerifyTier } from "./verify-tier";

export interface GateOutcome {
  readonly ok: boolean;
  readonly tier: VerifyTier;
  readonly records: readonly GateStepRecord[];
}

export const RECOVERY_HINT =
  "Gate failed. Run `bun run verify:fix` to apply formatters and re-run the gate.";

function writeLatest(outcome: GateOutcome, cwd: string, trigger: string): void {
  const target = latestPlanPath(cwd);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(
    target,
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        trigger,
        tier: outcome.tier,
        ok: outcome.ok,
        records: outcome.records,
      },
      null,
      2,
    ),
  );
}

function journalEntry(outcome: GateOutcome, trigger: string): GateLogEntry {
  return {
    finishedAt: new Date().toISOString(),
    trigger,
    tier: outcome.tier,
    ok: outcome.ok,
    records: outcome.records,
  };
}

export function runVerifyGate(
  trigger = process.env.VERIFY_TRIGGER ?? "manual",
  cwd = process.cwd(),
): GateOutcome {
  const tier = classifyVerifyTier(changedFiles(cwd), trigger);
  const steps = planGateSteps(tier);
  const records: GateStepRecord[] = [];

  log.info(`verify gate: tier="${tier}" with ${steps.length} checks`);

  for (const step of steps) {
    const started = Date.now();
    log.info(`[${step.id}] ${step.command}`);
    const proc = spawnSync("sh", ["-c", step.command], {
      stdio: "inherit",
      env: process.env,
      cwd,
    });
    const record: GateStepRecord = {
      id: step.id,
      command: step.command,
      durationMs: Date.now() - started,
      ok: proc.status === 0,
    };
    records.push(record);
    if (!record.ok) {
      const outcome: GateOutcome = { ok: false, tier, records };
      writeLatest(outcome, cwd, trigger);
      appendEntry(journalEntry(outcome, trigger));
      log.failed(`Gate halted at step "${step.id}"`);
      log.warning(RECOVERY_HINT);
      return outcome;
    }
  }

  const outcome: GateOutcome = { ok: true, tier, records };
  writeLatest(outcome, cwd, trigger);
  appendEntry(journalEntry(outcome, trigger));
  log.success(`All ${records.length} gate checks passed (tier="${tier}")`);
  return outcome;
}

if (isMainModule(import.meta.url)) {
  const outcome = runVerifyGate();
  if (!outcome.ok) {
    process.exit(1);
  }
}
