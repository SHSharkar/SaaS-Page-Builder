import { describe, expect, it } from "vitest";
import {
  SUPPORTED_LOCALES,
  formatCatalogMessage,
  getCatalog,
} from "./client-catalog";

function flattenKeys(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") {
      Object.assign(out, flattenKeys(v as Record<string, unknown>, next));
    } else if (typeof v === "string") {
      out[next] = v;
    }
  }
  return out;
}

describe("lib/client-catalog", () => {
  it("enforces complete key parity between en-GB and en-US", () => {
    expect(SUPPORTED_LOCALES).toEqual(["en-GB", "en-US"]);
    const gb = flattenKeys(
      getCatalog("en-GB") as unknown as Record<string, unknown>,
    );
    const us = flattenKeys(
      getCatalog("en-US") as unknown as Record<string, unknown>,
    );
    expect(Object.keys(gb).sort()).toEqual(Object.keys(us).sort());
  });

  it("formats catalog messages and validates ICU arguments", () => {
    expect(formatCatalogMessage("app.brand")).toBe("SaaS Page Builder");
    expect(
      formatCatalogMessage("workspace.activeSitesStat", { count: 4 }, "en-US"),
    ).toBe("Active sites: 4");
    expect(() => formatCatalogMessage("app.doesNotExist")).toThrow(
      "Missing catalog message key",
    );
    expect(() => formatCatalogMessage("workspace.activeSitesStat", {})).toThrow(
      "Missing ICU argument",
    );
  });
});
