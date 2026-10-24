import { describe, expect, it } from "vitest";
import { formatByteSize } from "./byte-size";

describe("lib/byte-size", () => {
  it("formats byte sizes across units", () => {
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(512)).toBe("512 B");
    expect(formatByteSize(2048)).toBe("2.0 KB");
    expect(formatByteSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("throws on negative or non-finite values", () => {
    expect(() => formatByteSize(-1)).toThrow("Invalid byte size");
    expect(() => formatByteSize(Number.NaN)).toThrow("Invalid byte size");
  });
});
