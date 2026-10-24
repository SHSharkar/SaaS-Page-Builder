import { describe, expect, it } from "vitest";
import { isCrawlerUserAgent } from "./crawler-agents";

describe("lib/crawler-agents", () => {
  it("detects crawler and link preview user agents", () => {
    expect(isCrawlerUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(
      true,
    );
    expect(isCrawlerUserAgent("WhatsApp/2.26.1 i")).toBe(true);
    expect(
      isCrawlerUserAgent("Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36"),
    ).toBe(false);
    expect(isCrawlerUserAgent(null)).toBe(false);
  });
});
