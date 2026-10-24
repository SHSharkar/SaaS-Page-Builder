import { z } from "zod";
import {
  DOCUMENT_SCHEMA_VERSION,
  DEFAULT_ROOT_PROPS,
  type BlockNode,
  type MediaRef,
  type PageDocument,
} from "@/lib/documents";
import type { ResolvedMedia } from "@/lib/media/refs";
import { siteFrameBlocks } from "./blocks/site-frame";
import { conversionBlocks } from "./blocks/conversion";
import { moneyBlocks } from "./blocks/money";
import { contentBlocks } from "./blocks/content";
import { extraBlocks } from "./blocks/extra";
import { DEFAULT_APPEARANCE, type BlockDefinition, type ComponentGroup, type FieldDef } from "./types";

export const REGISTRY_LIST: BlockDefinition[] = [
  ...siteFrameBlocks,
  ...conversionBlocks,
  ...moneyBlocks,
  ...contentBlocks,
  ...extraBlocks,
] as unknown as BlockDefinition[];

export const BLOCKS: Record<string, BlockDefinition> = Object.fromEntries(
  REGISTRY_LIST.map((block) => [block.alias, block]),
);

export const GROUPS: { key: ComponentGroup; label: string; description: string }[] = [
  { key: "site-frame", label: "Site frame", description: "Edited once per site: header, footer, action dock." },
  { key: "conversion", label: "Hero and conversion", description: "First screen and calls to action." },
  { key: "money", label: "Money and trust", description: "Bonus terms, comparisons and licence badges." },
  { key: "content", label: "Content", description: "Copy, media, social proof and answers." },
  { key: "utility", label: "Utilities", description: "Spacing and rules." },
];

export const SITE_FRAME_ALIASES = siteFrameBlocks.map((block) => block.alias);

export function getBlock(alias: string): BlockDefinition | undefined {
  return BLOCKS[alias];
}

export function isBlockAvailable(alias: string): boolean {
  const block = BLOCKS[alias];
  return !!block && !block.deprecated;
}

export type ValidationResult =
  | { ok: true; document: PageDocument }
  | { ok: false; errors: string[]; document: PageDocument };

const MAX_DOCUMENT_CHARS = 200_000;

/**
 * The server re-checks every save against the registry (founding principle:
 * the server is the source of truth). Unknown aliases are refused so a
 * document can never point at a component the code does not ship.
 */
export function validateDocument(input: unknown): ValidationResult {
  const errors: string[] = [];
  const raw = (input ?? {}) as Partial<PageDocument>;

  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["The document must be an object."], document: emptyDoc() };
  }
  if (!Array.isArray(raw.content)) errors.push("The document needs a content array.");
  if (JSON.stringify(raw).length > MAX_DOCUMENT_CHARS) {
    errors.push("The page is over the 200,000 character limit.");
  }

  const content: BlockNode[] = [];
  for (const node of raw.content ?? []) {
    const type = typeof node?.type === "string" ? node.type : "";
    const definition = BLOCKS[type];
    if (!definition) {
      errors.push(`Unknown component "${type || "(missing)"}".`);
      continue;
    }
    const parsed = definition.schema.safeParse(node.props ?? {});
    if (!parsed.success) {
      errors.push(`"${definition.name}" has invalid fields: ${parsed.error.issues[0]?.message ?? "unknown"}`);
      continue;
    }
    content.push({ type, props: parsed.data as BlockNode["props"] });
  }

  const rootProps = z
    .looseObject({
      contentWidth: z.enum(["narrow", "default", "wide"]).catch(DEFAULT_ROOT_PROPS.contentWidth),
      background: z.enum(["default", "surface", "dark"]).catch(DEFAULT_ROOT_PROPS.background),
      hideHeader: z.coerce.boolean().catch(false),
      hideFooter: z.coerce.boolean().catch(false),
      hideDock: z.coerce.boolean().catch(false),
    })
    .safeParse(raw.root?.props ?? {});

  const document: PageDocument = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: rootProps.success ? (rootProps.data as PageDocument["root"]["props"]) : { ...DEFAULT_ROOT_PROPS } },
    content,
    ...(raw.zones && typeof raw.zones === "object" ? { zones: raw.zones } : {}),
  };

  return errors.length ? { ok: false, errors, document } : { ok: true, document };
}

function emptyDoc(): PageDocument {
  return { schemaVersion: DOCUMENT_SCHEMA_VERSION, root: { props: { ...DEFAULT_ROOT_PROPS } }, content: [] };
}

/** Walks a block's field definitions so repeaters resolve too. */
function resolveFields(
  fields: FieldDef[],
  props: Record<string, unknown>,
  media: Map<string, ResolvedMedia>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...props };
  for (const field of fields) {
    const value = props[field.key];
    if (field.type === "image") {
      const ref = value as MediaRef | null;
      if (ref && typeof ref === "object" && "id" in ref) {
        const found = media.get(ref.id);
        out[field.key] = found ? { ...ref, ...found } : { ...ref };
      }
    } else if (field.type === "repeater" && Array.isArray(value)) {
      out[field.key] = value.map((item) =>
        item && typeof item === "object"
          ? resolveFields(field.fields ?? [], item as Record<string, unknown>, media)
          : item,
      );
    }
  }
  return out;
}

/** Replaces media identifiers with resolved URLs immediately before rendering. */
export function resolveDocumentMedia(doc: PageDocument, media: Map<string, ResolvedMedia>): PageDocument {
  return {
    ...doc,
    content: (doc.content ?? []).map((node) => {
      const definition = BLOCKS[node.type];
      if (!definition) return node;
      return { ...node, props: resolveFields(definition.fields, node.props, media) as BlockNode["props"] };
    }),
  };
}

export function collectDocumentMedia(doc: PageDocument | null | undefined): Set<string> {
  const ids = new Set<string>();
  if (!doc) return ids;
  for (const node of doc.content ?? []) {
    const definition = BLOCKS[node.type];
    if (!definition) continue;
    for (const field of definition.fields) {
      const value = node.props?.[field.key];
      if (field.type === "image" && value && typeof value === "object" && "id" in value) {
        ids.add(String((value as MediaRef).id));
      }
      if (field.type === "repeater" && Array.isArray(value)) {
        for (const item of value) {
          for (const sub of field.fields ?? []) {
            if (sub.type === "image") {
              const subValue = (item as Record<string, unknown>)?.[sub.key];
              if (subValue && typeof subValue === "object" && "id" in (subValue as object)) {
                ids.add(String((subValue as MediaRef).id));
              }
            }
          }
        }
      }
    }
  }
  return ids;
}

export function defaultPropsFor(alias: string): Record<string, unknown> {
  const definition = BLOCKS[alias];
  if (!definition) return {};
  const defaults = JSON.parse(JSON.stringify(definition.defaults)) as Record<string, unknown>;
  return { appearance: { ...DEFAULT_APPEARANCE }, ...defaults };
}

export function searchCatalog(
  query: string,
  options: { excludeSiteFrame?: boolean; includeDeprecated?: boolean } = {},
): BlockDefinition[] {
  const q = query.trim().toLowerCase();
  return REGISTRY_LIST.filter((block) => {
    if (!options.includeDeprecated && block.deprecated) return false;
    if (options.excludeSiteFrame && SITE_FRAME_ALIASES.includes(block.alias)) return false;
    if (!q) return true;
    return (
      block.name.toLowerCase().includes(q) ||
      block.alias.includes(q) ||
      block.description.toLowerCase().includes(q) ||
      block.group.includes(q)
    );
  });
}

export const REGISTRY_STATS = {
  total: REGISTRY_LIST.length,
  launch: REGISTRY_LIST.filter((block) => !block.deprecated && (block.wave ?? 1) === 1).length,
  waveTwo: REGISTRY_LIST.filter((block) => block.wave === 2 && !block.deprecated).length,
  groups: GROUPS.length,
};

export const WAVE_OF = (block: BlockDefinition) => block.wave ?? 1;

export type { BlockDefinition, FieldDef };
