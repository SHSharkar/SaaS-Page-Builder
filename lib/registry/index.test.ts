import { describe, expect, it } from "vitest";
import { emptyDocument, parsePageDocument } from "@/lib/documents";
import {
  BLOCK_CATALOG,
  collectMediaIdsFromDocument,
  collectTrackingPlacements,
  documentAdminBlockAliases,
  getBlockSpec,
  validateDocument,
} from "./index";

describe("lib/registry", () => {
  it("provides all 35 unique code-owned blocks", () => {
    expect(BLOCK_CATALOG).toHaveLength(35);
    const aliases = new Set(BLOCK_CATALOG.map((b) => b.alias));
    expect(aliases.size).toBe(35);
    expect(getBlockSpec("hero-banner")?.group).toBe("conversion");
    expect(getBlockSpec("raw-html")?.adminOnly).toBe(true);
    expect(getBlockSpec("embed")?.adminOnly).toBe(true);
  });

  it("validates documents and extracts admin blocks, media refs, and placements", () => {
    const doc = emptyDocument("Home");
    doc.content.push(
      {
        id: "n1",
        type: "hero-banner",
        props: {
          headline: "Ship faster",
          ctaLabel: "Start",
          ctaHref: "https://example.com/start",
          heroMediaId: "0192b123-4567-7890-abcd-ef1234567890",
        },
      },
      {
        id: "n2",
        type: "raw-html",
        props: { html: "<p>Hello</p>" },
      },
      {
        id: "n3",
        type: "unknown-preview",
        props: {},
      },
    );

    expect(documentAdminBlockAliases(doc)).toEqual(["raw-html"]);
    expect(collectMediaIdsFromDocument(doc)).toEqual([
      "0192b123-4567-7890-abcd-ef1234567890",
    ]);
    expect(collectTrackingPlacements(doc)).toHaveLength(1);

    const badUnknown = validateDocument(doc);
    expect(badUnknown.valid).toBe(false);
    expect(badUnknown.errors[0]).toContain("Unknown block type");

    const missingRequired = emptyDocument("Missing");
    missingRequired.content.push({
      id: "h-empty",
      type: "hero-banner",
      props: {},
    });
    expect(validateDocument(missingRequired).valid).toBe(false);

    expect(validateDocument({ root: {}, content: [] } as never).valid).toBe(
      false,
    );

    const huge = emptyDocument("Huge");
    huge.content.push({
      id: "big",
      type: "rich-text",
      props: { body: "x".repeat(250_000), heading: "Big" },
    });
    expect(validateDocument(huge).valid).toBe(false);

    expect(parsePageDocument(null).root.title).toBe("Home");
    expect(parsePageDocument(emptyDocument("Valid")).root.title).toBe("Valid");
  });
});
