import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("docker build context and image rules", () => {
  it("pins oven/bun:1.4.4-slim, non-root USER bun, and excludes secrets in .dockerignore", () => {
    const root = process.cwd();
    const webDocker = fs.readFileSync(path.join(root, "Dockerfile"), "utf8");
    const workerDocker = fs.readFileSync(
      path.join(root, "Dockerfile.worker"),
      "utf8",
    );
    const ignore = fs.readFileSync(path.join(root, ".dockerignore"), "utf8");

    expect(webDocker).toContain("FROM oven/bun:1.4.4-slim");
    expect(webDocker).toContain("USER bun");
    expect(webDocker).toContain("HEALTHCHECK");

    expect(workerDocker).toContain("FROM oven/bun:1.4.4-slim");
    expect(workerDocker).toContain("USER bun");

    expect(ignore).toContain("node_modules");
    expect(ignore).toContain(".env");
  });
});
