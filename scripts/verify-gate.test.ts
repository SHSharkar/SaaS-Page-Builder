import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SHOWN_ENTRIES,
  appendEntry,
  formatEntry,
  historyPath,
  isEntry,
  readEntries,
  shownEntries,
} from "./verify-log";
import {
  GATE_STEPS,
  changedFiles,
  describePlan,
  planGateSteps,
} from "./verify-plan";
import { classifyVerifyTier, requestedTier } from "./verify-tier";

const tempDirs: string[] = [];

function tempLogPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spb-verify-"));
  tempDirs.push(dir);
  return historyPath(dir);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

const sample = {
  finishedAt: "2026-10-24T10:00:00.000Z",
  trigger: "pre-push",
  tier: "code",
  ok: false,
  records: [
    { id: "format", command: "bun run format:check", durationMs: 12, ok: true },
    { id: "lint", command: "bun run lint", durationMs: 30, ok: false },
  ],
};

describe("verify gate plan", () => {
  it("orders tiers so stricter tiers include every weaker-tier check", () => {
    const ids = (tier: "fast" | "code" | "schema" | "full"): string[] =>
      planGateSteps(tier).map((step) => step.id);

    expect(ids("fast")).toContain("format");
    expect(ids("fast")).not.toContain("lint");
    expect(ids("code")).toContain("lint");
    expect(ids("code")).not.toContain("rls");
    expect(ids("schema")).toContain("rls");
    expect(ids("schema")).not.toContain("licenses");
    expect(ids("full")).toContain("licenses");
    expect(ids("full")).toEqual(GATE_STEPS.map((step) => step.id));
    expect(planGateSteps("full")).toHaveLength(24);
    expect(new Set(ids("full")).size).toBe(GATE_STEPS.length);
  });

  it("describes a plan and discovers changed files in this repository", () => {
    expect(describePlan("fast")).toContain('tier "fast"');
    const changed = changedFiles();
    expect(Array.isArray(changed)).toBe(true);
    expect(changed.every((file) => !file.startsWith("./"))).toBe(true);
  });

  it("honours an explicit tier request and falls back when unset", () => {
    expect(requestedTier({ VERIFY_TIER: "schema" })).toBe("schema");
    expect(requestedTier({ VERIFY_TIER: "nonsense" })).toBeNull();
    expect(requestedTier({})).toBeNull();
    expect(classifyVerifyTier(["lib/cn.ts"], "pre-push", "fast")).toBe("fast");
  });
});

describe("verify gate journal", () => {
  it("appends, reads back, and formats gate runs", () => {
    const target = tempLogPath();
    expect(readEntries(target)).toEqual([]);

    appendEntry(sample, target);
    appendEntry({ ...sample, ok: true, tier: "full" }, target);

    const entries = readEntries(target);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.tier).toBe("code");

    const formatted = formatEntry(sample);
    expect(formatted).toContain("fail");
    expect(formatted).toContain("failed: lint");
    expect(formatEntry({ ...sample, ok: true, records: [] })).toContain("pass");
  });

  it("ignores corrupt lines and unknown entry shapes", () => {
    const target = tempLogPath();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      [
        "not json",
        JSON.stringify({ finishedAt: "x" }),
        JSON.stringify(sample),
        "",
      ].join("\n"),
    );
    expect(readEntries(target)).toHaveLength(1);
    expect(isEntry(sample)).toBe(true);
    expect(isEntry(null)).toBe(false);
    expect(isEntry({ ...sample, records: [{ id: 1 }] })).toBe(false);
  });

  it("limits reported history and keeps the newest runs", () => {
    const entries = Array.from({ length: 12 }, (_, index) => ({
      ...sample,
      finishedAt: `2026-10-24T10:00:0${index}.000Z`,
    }));
    expect(shownEntries(entries, 2)).toHaveLength(2);
    expect(shownEntries(entries, 0)).toEqual([]);
    expect(shownEntries(entries)).toHaveLength(DEFAULT_SHOWN_ENTRIES);
    expect(shownEntries(entries, 2)[1]?.finishedAt).toContain("11.000Z");
  });
});
