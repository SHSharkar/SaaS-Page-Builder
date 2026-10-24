import { describe, expect, it } from "vitest";
import { isUuid, publicSubscriberLabel } from "./identifiers";

describe("lib/identifiers", () => {
  it("validates UUIDs and formats anonymous subscriber labels", () => {
    expect(isUuid("0192b123-4567-7890-abcd-ef1234567890")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(publicSubscriberLabel("pub_abcdef123456", 42)).toBe(
      "#42 (pub_abcd)",
    );
  });
});
