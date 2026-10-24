import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";

const REQUIRED_TOOLS = ["shellcheck", "shfmt"] as const;

interface ToolRun {
  readonly ok: boolean;
  readonly detail: string;
}

export function collectShellTargets(rootDir: string): string[] {
  const targets: string[] = [];
  const huskyDir = path.join(rootDir, ".husky");
  if (fs.existsSync(huskyDir)) {
    for (const entry of fs.readdirSync(huskyDir, { withFileTypes: true })) {
      if (entry.isFile() && !entry.name.startsWith("_")) {
        targets.push(path.join(".husky", entry.name));
      }
    }
  }
  const scriptsDir = path.join(rootDir, "scripts");
  if (fs.existsSync(scriptsDir)) {
    for (const entry of fs.readdirSync(scriptsDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith(".sh")) {
        targets.push(path.join("scripts", entry.name));
      }
    }
  }
  return targets.sort();
}

function missingTool(tool: string): boolean {
  const probe = spawnSync(tool, ["--version"], { encoding: "utf8" });
  return Boolean(probe.error) || probe.status === null;
}

function runTool(
  tool: string,
  args: readonly string[],
  rootDir: string,
): ToolRun {
  const result = spawnSync(tool, [...args], { cwd: rootDir, encoding: "utf8" });
  if (result.error) {
    return {
      ok: false,
      detail: `${tool} could not run: ${result.error.message}`,
    };
  }
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status === 0) {
    return { ok: true, detail: `${tool} clean` };
  }
  return {
    ok: false,
    detail: output.length > 0 ? output : `${tool} exited ${result.status}`,
  };
}

export function verifyShell(rootDir = process.cwd()): CheckResult {
  const targets = collectShellTargets(rootDir);
  if (targets.length === 0) {
    return passCheck("verify:shell", "No shell scripts present");
  }

  const absent = REQUIRED_TOOLS.filter((tool) => missingTool(tool));
  if (absent.length > 0) {
    return failCheck(
      "verify:shell",
      "Shell linting tools are not installed",
      absent.map(
        (tool) =>
          `${tool} is required: install shellcheck and shfmt (https://github.com/koalaman/shellcheck, https://github.com/mvdan/sh)`,
      ),
    );
  }

  const runs = [
    runTool("shellcheck", targets, rootDir),
    runTool("shfmt", ["-d", "-i", "2", "-ci", ...targets], rootDir),
  ];
  const failures = runs.filter((run) => !run.ok).map((run) => run.detail);

  return failures.length === 0
    ? passCheck(
        "verify:shell",
        `Verified ${targets.length} POSIX shell script(s) with shellcheck and shfmt`,
      )
    : failCheck("verify:shell", "Shell script lint/format failed", failures);
}

void runCliCheck(import.meta.url, () => verifyShell());
