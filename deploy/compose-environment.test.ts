import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function composeFile(): string {
  return fs.readFileSync(
    path.join(process.cwd(), "docker-compose.yml"),
    "utf8",
  );
}

describe("docker-compose environment and hardening rules", () => {
  it("orchestrates migrate, web, and worker with read-only rootfs and dropped capabilities", () => {
    const compose = composeFile();
    expect(compose).toContain("migrate:");
    expect(compose).toContain("web:");
    expect(compose).toContain("worker:");
    expect(compose).toContain("service_completed_successfully");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("no-new-privileges:true");
    expect(compose).toContain("- ALL");
    expect(compose).toContain('restart: "no"');
  });

  it("keeps the web port private, requires secrets, and caps every service", () => {
    const compose = composeFile();
    expect(compose).not.toMatch(/ports:/);
    expect(compose).toContain('expose:\n      - "3000"');
    expect(compose).toContain("caddy_ingress_network: coolify");
    expect(compose).toContain("${DATABASE_URL:?DATABASE_URL is required}");
    expect(compose).toContain(
      "${SETTINGS_ENCRYPTION_KEY:?SETTINGS_ENCRYPTION_KEY is required}",
    );
    expect(compose.match(/memory: 1536M/)).toBeTruthy();
    expect(compose.match(/pids: 768/g)).toHaveLength(2);
    expect(compose).toContain("scripts/worker-healthcheck.ts");
    expect(compose.match(/max-size: "16m"/g)).toHaveLength(1);
  });
});
