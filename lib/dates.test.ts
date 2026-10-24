import { describe, expect, it } from "vitest";
import { formatDateTime, formatIsoDate, formatShortDate } from "./dates";

describe("lib/dates", () => {
  it("formats dates deterministically in UTC", () => {
    const sample = new Date("2026-10-24T14:30:00.000Z");
    expect(formatIsoDate(sample)).toBe("2026-10-24");
    expect(formatShortDate(sample, "en-GB")).toContain("2026");
    expect(formatShortDate("2026-10-24T14:30:00.000Z", "en-GB")).toContain(
      "Oct",
    );
    expect(formatDateTime(sample.getTime(), "en-US")).toContain("14:30");
  });

  it("throws on invalid date values", () => {
    expect(() => formatIsoDate("not-a-date")).toThrow("Invalid date input");
  });
});
