import { describe, expect, it } from "vitest";
import {
  SHORT_CODE_LENGTH,
  generateShortCode,
  goShortPath,
  isValidScanSegment,
  isValidShortCode,
  scanSharePath,
} from "./short-paths";

describe("lib/short-paths", () => {
  it("generates 130+ bit 26-symbol short codes and builds /go and /scan paths", () => {
    const code = generateShortCode();
    expect(code).toHaveLength(SHORT_CODE_LENGTH);
    expect(isValidShortCode(code)).toBe(true);
    expect(goShortPath(code)).toBe(`/go/${code}`);
    expect(isValidScanSegment("acme-landing")).toBe(true);
    expect(scanSharePath("acme-landing")).toBe("/scan/acme-landing");
  });

  it("rejects malformed short codes and scan segments", () => {
    expect(isValidShortCode("TOO-SHORT-123")).toBe(false);
    expect(() => goShortPath("invalid")).toThrow("Invalid short code format");
    expect(isValidScanSegment("-bad-")).toBe(false);
    expect(() => scanSharePath("-bad-")).toThrow("Invalid scan segment format");
  });
});
