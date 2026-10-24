import { describe, expect, it } from "vitest";
import { APP_PATHS, PUBLIC_PATHS } from "./paths";

describe("lib/paths", () => {
  it("constructs workspace and public routes consistently", () => {
    expect(APP_PATHS.siteDetail("site_1")).toBe("/sites/site_1");
    expect(APP_PATHS.sitePages("site_1")).toBe("/sites/site_1/pages");
    expect(APP_PATHS.siteEditor("site_1", "page_2")).toBe(
      "/sites/site_1/editor/page_2",
    );
    expect(APP_PATHS.sitePreview("site_1", "page_2")).toBe(
      "/sites/site_1/preview/page_2",
    );
    expect(APP_PATHS.siteGlobals("site_1")).toBe("/sites/site_1/globals");
    expect(APP_PATHS.siteDomains("site_1")).toBe("/sites/site_1/domains");
    expect(APP_PATHS.siteMedia("site_1")).toBe("/sites/site_1/media");
    expect(APP_PATHS.siteImports("site_1")).toBe("/sites/site_1/imports");
    expect(APP_PATHS.siteSettings("site_1")).toBe("/sites/site_1/settings");
    expect(PUBLIC_PATHS.publishedSite("acme")).toBe("/s/acme");
    expect(PUBLIC_PATHS.publishedSite("acme", "/pricing")).toBe(
      "/s/acme/pricing",
    );
    expect(PUBLIC_PATHS.publishedSite("acme", "about")).toBe("/s/acme/about");
  });
});
