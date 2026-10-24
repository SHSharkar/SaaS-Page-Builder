import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_ENV_DEFAULTS,
  applyDevelopmentEnvDefaults,
} from "./development-env";

describe("lib/development-env", () => {
  it("fills missing development keys without overwriting existing values", () => {
    const target: Record<string, string | undefined> = {
      NODE_ENV: "development",
      ADMIN_PATH: "/custom-ops",
      REDIS_URL: "   ",
    };
    applyDevelopmentEnvDefaults(target);
    expect(target.ADMIN_PATH).toBe("/custom-ops");
    expect(target.REDIS_URL).toBe(DEVELOPMENT_ENV_DEFAULTS.REDIS_URL);
    expect(target.DATABASE_URL).toBe(DEVELOPMENT_ENV_DEFAULTS.DATABASE_URL);
  });

  it("does nothing when NODE_ENV is production", () => {
    const target: Record<string, string | undefined> = {
      NODE_ENV: "production",
    };
    applyDevelopmentEnvDefaults(target);
    expect(target.DATABASE_URL).toBeUndefined();
  });
});
