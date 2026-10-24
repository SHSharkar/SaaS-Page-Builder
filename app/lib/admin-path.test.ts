import { describe, expect, it } from "vitest";
import { adminHref, normalizeAdminPath } from "./admin-path";

describe("app/lib/admin-path", () => {
  it("normalizes admin base paths and joins subpaths", () => {
    expect(normalizeAdminPath(undefined)).toBe("/admin");
    expect(normalizeAdminPath("console-ops/")).toBe("/console-ops");
    expect(normalizeAdminPath("/")).toBe("/admin");
    expect(adminHref("accounts", "/console-ops")).toBe("/console-ops/accounts");
    expect(adminHref("/accounts", "/console-ops")).toBe(
      "/console-ops/accounts",
    );
    expect(adminHref("", "/console-ops")).toBe("/console-ops");
    expect(adminHref()).toBeTruthy();
  });
});
