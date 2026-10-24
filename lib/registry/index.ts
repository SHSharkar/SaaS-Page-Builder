import {
  assertDocumentSize,
  pageDocumentSchema,
  type PageDocument,
} from "@/lib/documents";
import { BLOCK_CATALOG } from "./blocks";
import type { BlockSpec, ExtractedPlacement } from "./types";

export type { BlockSpec, ExtractedPlacement } from "./types";
export { BLOCK_CATALOG };

export const BLOCK_BY_ALIAS: ReadonlyMap<string, BlockSpec> = new Map(
  BLOCK_CATALOG.map((spec) => [spec.alias, spec]),
);

export function getBlockSpec(alias: string): BlockSpec | undefined {
  return BLOCK_BY_ALIAS.get(alias);
}

export function documentAdminBlockAliases(doc: PageDocument): string[] {
  const found = new Set<string>();
  for (const node of doc.content) {
    const spec = BLOCK_BY_ALIAS.get(node.type);
    if (spec?.adminOnly) {
      found.add(spec.alias);
    }
  }
  return [...found];
}

export function collectMediaIdsFromDocument(doc: PageDocument): string[] {
  const ids = new Set<string>();
  for (const node of doc.content) {
    const spec = BLOCK_BY_ALIAS.get(node.type);
    if (!spec) {
      continue;
    }
    for (const field of spec.fields) {
      if (field.kind === "media") {
        const val = node.props[field.key];
        if (typeof val === "string" && val.trim().length > 0) {
          ids.add(val.trim());
        }
      }
    }
  }
  return [...ids];
}

export function collectTrackingPlacements(
  doc: PageDocument,
): ExtractedPlacement[] {
  const placements: ExtractedPlacement[] = [];
  for (const node of doc.content) {
    const spec = BLOCK_BY_ALIAS.get(node.type);
    if (!spec) {
      continue;
    }
    for (const field of spec.fields) {
      if (field.kind !== "url") {
        continue;
      }
      const href = node.props[field.key];
      if (typeof href === "string" && href.trim().length > 0) {
        placements.push({
          blockId: node.id,
          blockType: spec.alias,
          fieldPath: field.key,
          label: String(
            node.props.ctaLabel ?? node.props.headline ?? field.label,
          ),
          destinationUrl: href.trim(),
          trackingId: `${node.id}:${field.key}`,
        });
      }
    }
  }
  return placements;
}

export function validateDocument(doc: PageDocument): {
  valid: boolean;
  errors: string[];
} {
  const parsed = pageDocumentSchema.safeParse(doc);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((i) => i.message),
    };
  }
  try {
    assertDocumentSize(doc);
  } catch (err) {
    return {
      valid: false,
      errors: [err instanceof Error ? err.message : "Document too large"],
    };
  }
  const errors: string[] = [];
  for (const node of doc.content) {
    const spec = BLOCK_BY_ALIAS.get(node.type);
    if (!spec) {
      errors.push(`Unknown block type: ${node.type}`);
      continue;
    }
    for (const field of spec.fields) {
      if (field.required) {
        const val = node.props[field.key];
        if (typeof val !== "string" || val.trim().length === 0) {
          errors.push(`Block ${node.type} (${node.id}) requires ${field.key}`);
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}
