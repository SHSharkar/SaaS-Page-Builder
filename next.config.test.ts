import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config.ts", () => {
  it("builds as standalone output without X-Powered-By", () => {
    expect(nextConfig.output).toBe("standalone");
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("delegates TypeScript checking to the pre-push gate", () => {
    expect(nextConfig.typescript?.ignoreBuildErrors).toBe(true);
  });

  it("keeps native and server packages external", () => {
    expect(nextConfig.serverExternalPackages).toEqual(
      expect.arrayContaining([
        "@node-rs/argon2",
        "pg",
        "pg-boss",
        "pino",
        "sharp",
      ]),
    );
  });

  it("enables Turbopack filesystem cache and server action body limit", () => {
    expect(nextConfig.experimental?.turbopackFileSystemCacheForDev).toBe(true);
    expect(nextConfig.experimental?.serverActions?.bodySizeLimit).toBe("6mb");
  });
});
