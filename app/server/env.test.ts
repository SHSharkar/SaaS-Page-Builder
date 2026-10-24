import { describe, expect, it } from "vitest";
import { DEVELOPMENT_ENV_DEFAULTS } from "@/lib/development-env";
import { bootstrapEnv, resetBootstrapState } from "./bootstrap-env";
import { getEnv, parseServerEnv, resetEnvCache } from "./env";

describe("app/server/env and bootstrap-env", () => {
  it("parses valid server environment and caches getEnv()", () => {
    resetEnvCache();
    resetBootstrapState();
    const parsed = parseServerEnv({
      ...DEVELOPMENT_ENV_DEFAULTS,
      NODE_ENV: "test",
    });
    expect(parsed.ADMIN_PATH).toBe("/admin");
    bootstrapEnv();
    bootstrapEnv();
    expect(getEnv().PLATFORM_DOMAIN).toBeTruthy();
  });

  it("rejects malformed encryption keys", () => {
    expect(() =>
      parseServerEnv({
        ...DEVELOPMENT_ENV_DEFAULTS,
        SETTINGS_ENCRYPTION_KEY: "short",
      }),
    ).toThrow("64-character hex");
  });
});
