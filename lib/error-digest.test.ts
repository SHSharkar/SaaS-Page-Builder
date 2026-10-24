import { describe, expect, it } from "vitest";
import { extractErrorDigest } from "./error-digest";

describe("lib/error-digest", () => {
  it("returns Next error digests when present", () => {
    expect(extractErrorDigest({ digest: "abc-123" })).toBe("abc-123");
    expect(extractErrorDigest({ digest: "  " })).toBeNull();
    expect(extractErrorDigest("plain")).toBeNull();
    expect(extractErrorDigest(null)).toBeNull();
  });
});
