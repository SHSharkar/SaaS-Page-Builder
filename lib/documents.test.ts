import { describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_BYTES,
  assertDocumentSize,
  cloneDocumentWithNewIds,
  emptyDocument,
  normalizeHostname,
  normalizePath,
  pageDocumentSchema,
  slugify,
} from "./documents";

describe("lib/documents", () => {
  it("normalizes slugs, paths, and hostnames", () => {
    expect(slugify("  Hello World! 2026 ")).toBe("hello-world-2026");
    expect(slugify("!!!")).toBe("untitled");
    expect(normalizePath("")).toBe("/");
    expect(normalizePath("/Pricing/Enterprise Plans?ref=1")).toBe(
      "/pricing/enterprise-plans",
    );
    expect(normalizeHostname("Example.COM:3000.")).toBe("example.com");
    expect(normalizeHostname("-invalid_host")).toBe("");
  });

  it("validates, clones, and checks size limits on documents", () => {
    const doc = emptyDocument("Landing");
    doc.content.push({
      id: "b1",
      type: "hero-banner",
      props: { headline: "Welcome" },
      appearance: { spacing: "spacious" },
    });
    expect(pageDocumentSchema.parse(doc).root.title).toBe("Landing");
    assertDocumentSize(doc);

    const cloned = cloneDocumentWithNewIds(doc);
    expect(cloned.content[0]?.id).not.toBe("b1");
    expect(cloned.content[0]?.props.headline).toBe("Welcome");

    const huge = emptyDocument("Huge");
    huge.content.push({
      id: "b_huge",
      type: "rich-text",
      props: { body: "x".repeat(MAX_DOCUMENT_BYTES + 1024) },
    });
    expect(() => assertDocumentSize(huge)).toThrow("200 KB");
  });
});
