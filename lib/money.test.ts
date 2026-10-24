import { describe, expect, it } from "vitest";
import { formatCount, formatMinorMoney } from "./money";

describe("lib/money", () => {
  it("formats minor currency amounts and integer counts", () => {
    expect(formatMinorMoney(4900, "USD", "en-US")).toBe("$49.00");
    expect(formatMinorMoney(4900, "USD", "en-US")).toBe("$49.00");
    expect(formatCount(12500, "en-US")).toBe("12,500");
  });

  it("rejects non-finite inputs", () => {
    expect(() => formatMinorMoney(Number.NaN)).toThrow(
      "Invalid minor money amount",
    );
    expect(() => formatCount(Number.POSITIVE_INFINITY)).toThrow(
      "Invalid count",
    );
  });
});
