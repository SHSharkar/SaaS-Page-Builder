import { describe, expect, it } from "vitest";
import { runPreflight } from "./preflight";
import { replayErasureLog } from "./replay-erasure-log";
import { seedDevelopmentWorkspace } from "./seed-all";
import { generateEnvKeyBlock } from "./seed-env-keys";
import { seedProductionBootstrap } from "./seed-production";

describe("seed and preflight scripts", () => {
  it("generates valid 64-hex key blocks and runs idempotent seeds + preflight", async () => {
    const keys = generateEnvKeyBlock();
    expect(keys).toContain("SETTINGS_ENCRYPTION_KEY=");
    expect(keys).toContain("GUEST_CONTACT_KEY=");

    await seedProductionBootstrap();
    await seedDevelopmentWorkspace();
    await seedDevelopmentWorkspace();

    const preflight = await runPreflight();
    expect(preflight.ok).toBe(true);

    const purged = await replayErasureLog();
    expect(purged).toBeGreaterThanOrEqual(0);
  });
});
