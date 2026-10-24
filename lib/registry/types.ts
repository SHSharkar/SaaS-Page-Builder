import type { BlockGroup } from "@/lib/enums";

export type FieldKind =
  "text" | "textarea" | "url" | "number" | "boolean" | "media" | "list";

export interface BlockFieldSpec {
  readonly key: string;
  readonly label: string;
  readonly kind: FieldKind;
  readonly required?: boolean;
}

export interface BlockSpec {
  readonly alias: string;
  readonly name: string;
  readonly group: BlockGroup;
  readonly description: string;
  readonly wave: 1 | 2;
  readonly adminOnly: boolean;
  readonly fields: readonly BlockFieldSpec[];
  readonly defaultProps: Readonly<Record<string, unknown>>;
}

export interface ExtractedPlacement {
  blockId: string;
  blockType: string;
  fieldPath: string;
  label: string;
  destinationUrl: string;
  trackingId: string;
}
