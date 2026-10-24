import type { ReactNode } from "react";
import { z } from "zod";

export type ComponentGroup = "site-frame" | "conversion" | "money" | "content" | "utility";

export type FieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "boolean"
  | "select"
  | "color"
  | "image"
  | "link"
  | "repeater"
  | "list";

export type FieldOption = { label: string; value: string };

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  options?: FieldOption[];
  fields?: FieldDef[];
  defaultItem?: Record<string, unknown>;
  itemLabel?: (item: Record<string, unknown>, index: number) => string;
  min?: number;
  max?: number;
  default?: unknown;
};

export type Appearance = {
  background: "inherit" | "surface" | "accent" | "muted" | "dark" | "light" | "transparent";
  spacing: "none" | "sm" | "md" | "lg" | "xl";
  width: "narrow" | "default" | "wide" | "full";
  align: "left" | "center";
  visibility: "all" | "desktop" | "mobile";
  anchor: string;
};

export const DEFAULT_APPEARANCE: Appearance = {
  background: "inherit",
  spacing: "md",
  width: "default",
  align: "left",
  visibility: "all",
  anchor: "",
};

export const APPEARANCE_FIELDS: FieldDef[] = [
  {
    key: "background",
    label: "Section background",
    type: "select",
    options: [
      { label: "Inherit page", value: "inherit" },
      { label: "Surface", value: "surface" },
      { label: "Accent", value: "accent" },
      { label: "Muted", value: "muted" },
      { label: "Deep dark", value: "dark" },
      { label: "Light", value: "light" },
      { label: "Transparent", value: "transparent" },
    ],
    default: "inherit",
  },
  {
    key: "spacing",
    label: "Vertical spacing",
    type: "select",
    options: [
      { label: "None", value: "none" },
      { label: "Compact", value: "sm" },
      { label: "Regular", value: "md" },
      { label: "Roomy", value: "lg" },
      { label: "Grand", value: "xl" },
    ],
    default: "md",
  },
  {
    key: "width",
    label: "Content width",
    type: "select",
    options: [
      { label: "Narrow", value: "narrow" },
      { label: "Default", value: "default" },
      { label: "Wide", value: "wide" },
      { label: "Full bleed", value: "full" },
    ],
    default: "default",
  },
  {
    key: "align",
    label: "Alignment",
    type: "select",
    options: [
      { label: "Left", value: "left" },
      { label: "Center", value: "center" },
    ],
    default: "left",
  },
  {
    key: "visibility",
    label: "Show on",
    type: "select",
    options: [
      { label: "Every device", value: "all" },
      { label: "Desktop only", value: "desktop" },
      { label: "Mobile only", value: "mobile" },
    ],
    default: "all",
  },
  { key: "anchor", label: "Anchor id (deep links)", type: "text", placeholder: "bonuses", default: "" },
];

export type BlockDefinition<Props extends Record<string, unknown> = Record<string, unknown>> = {
  alias: string;
  name: string;
  group: ComponentGroup;
  description: string;
  summary?: string;
  fields: FieldDef[];
  defaults: Props;
  schema: z.ZodType<Props>;
  render: (props: Props & { appearance: Appearance }) => ReactNode;
  deprecated?: boolean;
  adminOnly?: boolean;
  wave?: 1 | 2;
};

const IMAGE_SCHEMA = z
  .object({ id: z.string(), url: z.string().optional(), alt: z.string().optional() })
  .nullable()
  .catch(null);

const LINK_SCHEMA = z
  .object({
    label: z.string().default(""),
    href: z.string().default("#"),
    style: z.enum(["solid", "outline", "ghost", "light"]).default("solid"),
  })
  .catch({ label: "", href: "#", style: "solid" as const });

export function fieldSchema(field: FieldDef): z.ZodTypeAny {
  switch (field.type) {
    case "number":
      return z.coerce.number().catch(typeof field.default === "number" ? field.default : 0);
    case "boolean":
      return z.coerce.boolean().catch(false);
    case "select": {
      const values = (field.options ?? []).map((option) => option.value);
      const fallback = String(field.default ?? values[0] ?? "");
      return values.length
        ? z.enum(values as [string, ...string[]]).catch(fallback as never)
        : z.string().catch(fallback);
    }
    case "image":
      return IMAGE_SCHEMA;
    case "link":
      return LINK_SCHEMA;
    case "list":
      return z.array(z.string()).catch([]);
    case "repeater": {
      const item = z.object(
        Object.fromEntries((field.fields ?? []).map((sub) => [sub.key, fieldSchema(sub)])),
      );
      return z.array(item).catch([]);
    }
    case "color":
      return z
        .string()
        .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
        .catch(typeof field.default === "string" ? field.default : "#c8a24a");
    default:
      return z.string().catch(typeof field.default === "string" ? field.default : "");
  }
}

export function propsSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) shape[field.key] = fieldSchema(field);
  shape.appearance = z
    .object({
      background: z
        .enum(["inherit", "surface", "accent", "muted", "dark", "light", "transparent"])
        .catch("inherit"),
      spacing: z.enum(["none", "sm", "md", "lg", "xl"]).catch("md"),
      width: z.enum(["narrow", "default", "wide", "full"]).catch("default"),
      align: z.enum(["left", "center"]).catch("left"),
      visibility: z.enum(["all", "desktop", "mobile"]).catch("all"),
      anchor: z.string().catch(""),
    })
    .catch(DEFAULT_APPEARANCE);
  return z.looseObject(shape);
}

export function fieldDefaults(fields: FieldDef[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.default !== undefined) out[field.key] = field.default;
    else if (field.type === "image") out[field.key] = null;
    else if (field.type === "link") out[field.key] = { label: "Learn more", href: "#", style: "solid" };
    else if (field.type === "list") out[field.key] = [];
    else if (field.type === "repeater") out[field.key] = field.defaultItem ? [field.defaultItem] : [];
    else if (field.type === "number") out[field.key] = 0;
    else if (field.type === "boolean") out[field.key] = false;
    else if (field.type === "select") out[field.key] = field.options?.[0]?.value ?? "";
    else out[field.key] = "";
  }
  return out;
}
