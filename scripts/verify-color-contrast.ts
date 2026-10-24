import fs from "node:fs";
import path from "node:path";
import {
  type CheckResult,
  failCheck,
  passCheck,
  runCliCheck,
} from "./lib/check";

const REQUIRED_PAIRS: ReadonlyArray<readonly [string, string, number]> = [
  ["--text-primary", "--surface-canvas", 4.5],
  ["--text-primary", "--surface-card", 4.5],
  ["--text-secondary", "--surface-canvas", 4.5],
  ["--text-secondary", "--surface-card", 4.5],
  ["--text-on-accent", "--surface-accent", 4.5],
  ["--text-on-accent", "--surface-danger", 4.5],
];

function expandHex(raw: string): string {
  const clean = raw.trim().replace(/^#/, "");
  if (clean.length === 3) {
    return clean
      .split("")
      .map((ch) => `${ch}${ch}`)
      .join("");
  }
  return clean;
}

function channelLuminance(byteVal: number): number {
  const srgb = byteVal / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const full = expandHex(hex);
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(fgHex: string, bgHex: string): number {
  const l1 = relativeLuminance(fgHex);
  const l2 = relativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseBlockTokens(css: string, selector: string): Map<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const blockMatch = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  const map = new Map<string, string>();
  if (!blockMatch?.[1]) {
    return map;
  }
  const propRegex = /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g;
  let m: RegExpExecArray | null = propRegex.exec(blockMatch[1]);
  while (m) {
    if (m[1] && m[2]) {
      map.set(m[1], m[2]);
    }
    m = propRegex.exec(blockMatch[1]);
  }
  return map;
}

export function verifyColorContrast(rootDir = process.cwd()): CheckResult {
  const cssPath = path.join(rootDir, "app", "globals.css");
  const css = fs.readFileSync(cssPath, "utf8");
  const themes: ReadonlyArray<readonly [string, Map<string, string>]> = [
    ["light (:root)", parseBlockTokens(css, ":root")],
    ["dark (.dark)", parseBlockTokens(css, ".dark")],
  ];

  const failures: string[] = [];
  for (const [themeName, tokens] of themes) {
    for (const [fgName, bgName, minRatio] of REQUIRED_PAIRS) {
      const fg = tokens.get(fgName);
      const bg = tokens.get(bgName);
      if (!fg || !bg) {
        failures.push(`${themeName}: missing token ${fgName} or ${bgName}`);
        continue;
      }
      const ratio = contrastRatio(fg, bg);
      if (ratio < minRatio) {
        failures.push(
          `${themeName}: ${fgName} (${fg}) on ${bgName} (${bg}) = ${ratio.toFixed(2)}:1 (< ${minRatio}:1)`,
        );
      }
    }
  }

  return failures.length === 0
    ? passCheck(
        "verify:contrast",
        "All light and dark semantic token pairs meet WCAG AA contrast (>= 4.5:1)",
      )
    : failCheck(
        "verify:contrast",
        "Color contrast violations detected",
        failures,
      );
}

void runCliCheck(import.meta.url, () => verifyColorContrast());
