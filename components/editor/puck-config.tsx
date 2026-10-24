"use client";

import type { Config, Field } from "@puckeditor/core";
import { REGISTRY_LIST, SITE_FRAME_ALIASES } from "@/lib/registry";
import {
  APPEARANCE_FIELDS,
  DEFAULT_APPEARANCE,
  type FieldDef,
} from "@/lib/registry/types";
import { DEFAULT_ROOT_PROPS, type SiteTheme } from "@/lib/documents";
import { themeStyle } from "@/lib/render";
import type { ResolvedMedia } from "@/lib/media/refs";
import { ColorField, LinkField, ListField, MediaField, ToggleField } from "./fields";

export type ConfigOptions = {
  siteId: string;
  theme: SiteTheme;
  media: ResolvedMedia[];
  onUploaded: (asset: ResolvedMedia) => void;
  /** Site-frame components are edited as global content, not inside a page. */
  scope: "page" | "site-frame";
};

function toField(field: FieldDef, options: ConfigOptions): Field {
  switch (field.type) {
    case "text":
      return { type: "text", label: field.label, placeholder: field.placeholder };
    case "textarea":
    case "richtext":
      return { type: "textarea", label: field.label, placeholder: field.placeholder };
    case "number":
      return { type: "number", label: field.label, min: field.min, max: field.max };
    case "select":
      return {
        type: field.options && field.options.length <= 4 ? "radio" : "select",
        label: field.label,
        options: field.options ?? [],
      };
    case "boolean":
      return {
        type: "custom",
        label: field.label,
        render: ({ value, onChange }) => (
          <ToggleField label={field.label} hint={field.help} value={!!value} onChange={onChange} />
        ),
      };
    case "color":
      return {
        type: "custom",
        label: field.label,
        render: ({ value, onChange }) => (
          <ColorField label={field.label} value={value as string} onChange={onChange} />
        ),
      };
    case "image":
      return {
        type: "custom",
        label: field.label,
        render: ({ value, onChange, readOnly }) => (
          <MediaField
            label={field.label}
            hint={field.help}
            value={value as { id: string } | null}
            onChange={onChange}
            media={options.media}
            siteId={options.siteId}
            onUploaded={options.onUploaded}
            readOnly={readOnly}
          />
        ),
      };
    case "link":
      return {
        type: "custom",
        label: field.label,
        render: ({ value, onChange }) => (
          <LinkField
            label={field.label}
            value={value as { label: string; href: string; style?: string }}
            onChange={onChange}
          />
        ),
      };
    case "list":
      return {
        type: "custom",
        label: field.label,
        render: ({ value, onChange }) => (
          <ListField label={field.label} hint={field.help} value={value as string[]} onChange={onChange} />
        ),
      };
    case "repeater": {
      const arrayFields = Object.fromEntries(
        (field.fields ?? []).map((sub) => [sub.key, toField(sub, options)]),
      ) as Record<string, Field>;
      return {
        type: "array",
        label: field.label,
        arrayFields,
        defaultItemProps: field.defaultItem ?? {},
        getItemSummary: (item, index) =>
          field.itemLabel?.(item as Record<string, unknown>, index ?? 0) ??
          `Item ${(index ?? 0) + 1}`,
        max: field.max,
        min: field.min,
      };
    }
    default:
      return { type: "text", label: field.label };
  }
}

export function buildPuckConfig(options: ConfigOptions): Config {
  const definitions = REGISTRY_LIST.filter((definition) => {
    if (definition.deprecated) return false;
    const isFrame = SITE_FRAME_ALIASES.includes(definition.alias);
    return options.scope === "site-frame" ? true : !isFrame;
  });

  const components: Record<string, unknown> = {};
  for (const definition of definitions) {
    const domainFields = Object.fromEntries(
      definition.fields.map((field) => [field.key, toField(field, options)]),
    );
    components[definition.alias] = {
      label: definition.name,
      fields: {
        ...domainFields,
        appearance: {
          type: "object",
          label: "Layout and style",
          objectFields: Object.fromEntries(
            APPEARANCE_FIELDS.map((field) => [field.key, toField(field, options)]),
          ),
        },
      },
      defaultProps: { appearance: { ...DEFAULT_APPEARANCE }, ...definition.defaults },
      render: definition.render as unknown as (props: Record<string, unknown>) => React.ReactNode,
      metadata: { group: definition.group, description: definition.description },
    };
  }

  const categories = Object.fromEntries(
    [...new Set(definitions.map((definition) => definition.group))].map((group) => [
      group,
      {
        title:
          {
            "site-frame": "Site frame",
            conversion: "Hero and conversion",
            money: "Money and trust",
            content: "Content",
            utility: "Utilities",
          }[group] ?? group,
        components: definitions.filter((definition) => definition.group === group).map((d) => d.alias),
      },
    ]),
  );

  return {
    components,
    categories,
    root: {
      fields: {
        contentWidth: {
          type: "radio",
          label: "Content width",
          options: [
            { label: "Narrow", value: "narrow" },
            { label: "Default", value: "default" },
            { label: "Wide", value: "wide" },
          ],
        },
        background: {
          type: "select",
          label: "Page background",
          options: [
            { label: "Theme default", value: "default" },
            { label: "Surface", value: "surface" },
            { label: "Deep dark", value: "dark" },
          ],
        },
        hideHeader: {
          type: "custom",
          label: "Hide the site header on this page",
          render: ({ value, onChange }: { value?: unknown; onChange: (value: unknown) => void }) => (
            <ToggleField label="Hide the site header on this page" value={!!value} onChange={onChange} />
          ),
        },
        hideFooter: {
          type: "custom",
          label: "Hide the site footer on this page",
          render: ({ value, onChange }: { value?: unknown; onChange: (value: unknown) => void }) => (
            <ToggleField label="Hide the site footer on this page" value={!!value} onChange={onChange} />
          ),
        },
        hideDock: {
          type: "custom",
          label: "Hide the sticky action dock",
          render: ({ value, onChange }: { value?: unknown; onChange: (value: unknown) => void }) => (
            <ToggleField label="Hide the sticky action dock" value={!!value} onChange={onChange} />
          ),
        },
      },
      defaultProps: { ...DEFAULT_ROOT_PROPS },
      render: ({ children }: { children?: React.ReactNode }) => (
        <div className="site-scope min-h-full" style={themeStyle(options.theme)}>
          {children}
        </div>
      ),
    },
  } as unknown as Config;
}
