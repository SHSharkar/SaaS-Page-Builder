import { describe, expect, it } from "vitest";
import { REDACTED_PATHS, createAppLogger } from "./index";

describe("app/server/logger", () => {
  it("configures Pino with sensitive field redaction", () => {
    const instance = createAppLogger("info");
    expect(instance.level).toBe("info");
    const defaultInstance = createAppLogger();
    expect(defaultInstance.level).toBeTruthy();
    expect(REDACTED_PATHS).toContain("*.password");
    expect(REDACTED_PATHS).toContain("*.phone");
  });
});
