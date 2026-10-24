import { describe, expect, it } from "vitest";
import {
  BLOCKS,
  REGISTRY_LIST,
  REGISTRY_STATS,
  WAVE_OF,
  defaultPropsFor,
  getBlock,
  validateDocument,
  collectDocumentMedia,
} from "@/lib/registry";
import { APPEARANCE_FIELDS, DEFAULT_APPEARANCE as APPEARANCE_DEFAULTS } from "@/lib/registry/types";
import { newPageDocument } from "@/lib/pages";

describe("catalog shape", () => {
  it("ships 27 launch blocks plus 8 in the second wave", () => {
    expect(REGISTRY_STATS.launch).toBe(27);
    expect(REGISTRY_STATS.waveTwo).toBe(8);
    expect(REGISTRY_STATS.total).toBe(35);
    expect(REGISTRY_LIST.filter((block) => WAVE_OF(block) === 2)).toHaveLength(8);
  });

  it("has a unique alias for every block", () => {
    const aliases = REGISTRY_LIST.map((block) => block.alias);
    expect(new Set(aliases).size).toBe(aliases.length);
    for (const alias of aliases) expect(getBlock(alias)).toBeTruthy();
  });

  it("gives every block a name, a group, a description and a renderer", () => {
    for (const block of REGISTRY_LIST) {
      expect(block.name, block.alias).toBeTruthy();
      expect(block.group, block.alias).toBeTruthy();
      expect(block.description, block.alias).toBeTruthy();
      expect(typeof block.render, block.alias).toBe("function");
    }
  });

  it("gives every block field definitions with types", () => {
    for (const block of REGISTRY_LIST) {
      expect(block.fields.length, block.alias).toBeGreaterThan(0);
      for (const field of block.fields) {
        expect(field.key, block.alias).toBeTruthy();
        expect(field.type, `${block.alias}.${field.key}`).toBeTruthy();
        expect(typeof field.label, `${block.alias}.${field.key}`).toBe("string");
      }
    }
  });

  it("renders every block from its defaults alone (the catalog preview)", () => {
    for (const block of REGISTRY_LIST) {
      const props = defaultPropsFor(block.alias);
      expect(() =>
        block.render({ ...props, appearance: APPEARANCE_DEFAULTS } as never),
      ).not.toThrow();
    }
  });

  it("carries the shared appearance controls on every block schema", () => {
    for (const block of REGISTRY_LIST) {
      const parsed = block.schema.safeParse({ ...defaultPropsFor(block.alias) });
      expect(parsed.success, block.alias).toBe(true);
    }
  });

  it("produces default props that satisfy the block's own schema", () => {
    for (const block of REGISTRY_LIST) {
      const props = defaultPropsFor(block.alias);
      expect(props, block.alias).toBeTruthy();
      const doc = { ...newPageDocument(), content: [{ type: block.alias, props: { id: "x", ...props } }] };
      const result = validateDocument(doc);
      expect(result.ok, `${block.alias}: ${result.ok ? "" : result.errors.join("; ")}`).toBe(true);
    }
  });

  it("declares the style vocabulary once, not per block", () => {
    expect(APPEARANCE_FIELDS.map((field) => field.key)).toEqual([
      "background",
      "spacing",
      "width",
      "align",
      "visibility",
      "anchor",
    ]);
  });
});

describe("document validation", () => {
  it("accepts an empty page", () => {
    expect(validateDocument(newPageDocument()).ok).toBe(true);
  });

  it("refuses a document with an unknown block", () => {
    const result = validateDocument({ ...newPageDocument(), content: [{ type: "made-up", props: {} }] });
    expect(result.ok).toBe(false);
  });

  it("assigns an id when a block arrives without one", () => {
    const result = validateDocument({ ...newPageDocument(), content: [{ type: "hero", props: {} }] });
    expect(result.ok).toBe(true);
    expect(typeof (result.document.content[0].props as { id?: string }).id).toBe("string");
  });

  it("refuses two blocks that share an id", () => {
    const result = validateDocument({
      ...newPageDocument(),
      content: [
        { type: "hero", props: { id: "same" } },
        { type: "faq", props: { id: "same" } },
      ],
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors.join(" ")).toContain("repeats the id");
  });

  it("refuses a non-object document", () => {
    expect(validateDocument("nope").ok).toBe(false);
    expect(validateDocument(null).ok).toBe(false);
  });

  it("refuses a dropped content array", () => {
    expect(validateDocument({ root: {}, content: "x" }).ok).toBe(false);
  });
});

describe("media references", () => {
  it("collects ids from every media field in the tree", () => {
    const imageBlock = REGISTRY_LIST.find((block) =>
      block.fields.some((field) => field.type === "image"),
    );
    expect(imageBlock).toBeTruthy();
    const imageField = imageBlock!.fields.find((field) => field.type === "image")!;
    const doc = {
      ...newPageDocument(),
      content: [
        { type: imageBlock!.alias, props: { id: "a", [imageField.key]: { id: "media-1" } } },
        { type: "faq", props: { id: "b" } },
      ],
    };
    expect(collectDocumentMedia(doc).has("media-1")).toBe(true);
  });

  it("reaches images nested inside repeaters", () => {
    const repeaterBlock = REGISTRY_LIST.find((block) =>
      block.fields.some((field) => field.type === "repeater" && field.fields?.some((sub) => sub.type === "image")),
    );
    expect(repeaterBlock).toBeTruthy();
    const repeater = repeaterBlock!.fields.find(
      (field) => field.type === "repeater" && field.fields?.some((sub) => sub.type === "image"),
    )!;
    const imageKey = repeater.fields!.find((sub) => sub.type === "image")!.key;
    const doc = {
      ...newPageDocument(),
      content: [
        {
          type: repeaterBlock!.alias,
          props: { id: "c", [repeater.key]: [{ [imageKey]: { id: "media-nested" } }] },
        },
      ],
    };
    expect(collectDocumentMedia(doc).has("media-nested")).toBe(true);
  });

  it("returns an empty set for a document with no images", () => {
    expect(collectDocumentMedia(newPageDocument()).size).toBe(0);
    expect(collectDocumentMedia(null).size).toBe(0);
  });
});

describe("BLOCKS map", () => {
  it("is keyed by alias", () => {
    for (const [alias, block] of Object.entries(BLOCKS)) expect(block.alias).toBe(alias);
  });
});
