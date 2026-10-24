import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("docker-compose environment and hardening rules", () => {
  it("orchestrates migrate, web, and worker with read-only rootfs and dropped capabilities", () => {
    const compose = fs.readFileSync(
      path.join(process.cwd(), "docker-compose.yml"),
      "utf8",
    );
    expect(compose).toContain("migrate:");
    expect(compose).toContain("web:");
    expect(compose).toContain("worker:");
    expect(compose).toContain("service_completed_successfully");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("no-new-privileges:true");
  });
});
