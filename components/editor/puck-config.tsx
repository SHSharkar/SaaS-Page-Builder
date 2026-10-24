"use client";

import type { ReactNode } from "react";
import type { Config, CustomField, Fields } from "@puckeditor/core";
import {
  COMPONENT_LIST,
  GROUP_LABELS,
  resolveDocumentMedia,
  type ComponentDefinition,
  type ComponentGroup,
  type FieldSpec,
  type ResolvedMedia,
} from "@/lib/registry";
import { APPEARANCE_FIELDS, DEFAULT_APPEARANCE } from "@/lib/registry/types";
import type { LinkTarget, MediaRef, SiteTheme } from "@/lib/documents";
import { uploadSiteMedia } from "@/lib/media/upload-client";
import {
  adminInputClass,
  adminLabelClass,
  adminSelectClass,
  themeRootClasses,
} from "@/lib/theme-classes";

export type MediaOption = {
  id: string;
  label: string;
  url: string;
  alt?: string;
};

const GROUPS: ComponentGroup[] = ["site-frame", "conversion", "money", "content", "utility"];

function buildImageField(
  spec: FieldSpec,
  siteId: string,
  media: MediaOption[],
  onUploaded: (created: MediaOption) => void,
): CustomField<MediaRef | null> {
  return {
    type: "custom",
    label: spec.label,
    render: ({ value, onChange }) => {
      const currentId = value && typeof value === "object" ? value.id : "";
      const selected = media.find((item) => item.id === currentId);
      return (
        <div className="space-y-2 py-1">
          <span className={adminLabelClass}>{spec.label}</span>
          <select
            className={adminSelectClass}
            value={currentId}
            onChange={(event) => {
              const id = event.target.value;
              if (!id) {
                onChange(null);
                return;
              }
              const hit = media.find((item) => item.id === id);
              onChange({
                id,
                url: hit?.url,
                alt: hit?.alt ?? hit?.label ?? "",
              });
            }}
          >
            <option value="">None selected</option>
            {media.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {selected ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
              <img
                src={selected.url}
                alt={selected.alt ?? selected.label}
                className="max-h-28 w-auto object-contain"
              />
            </div>
          ) : null}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50">
            <span>Upload a new image</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml"
              className="sr-only"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                const uploaded = await uploadSiteMedia(siteId, file);
                const option: MediaOption = {
                  id: uploaded.id,
                  label: file.name,
                  url: uploaded.url,
                  alt: uploaded.alt || file.name,
                };
                onUploaded(option);
                onChange({ id: option.id, url: option.url, alt: option.alt });
              }}
            />
          </label>
          {spec.help ? <p className="text-[11px] text-slate-400">{spec.help}</p> : null}
        </div>
      );
    },
  };
}

function buildBooleanField(spec: FieldSpec): CustomField<boolean> {
  return {
    type: "custom",
    label: spec.label,
    render: ({ value, onChange }) => (
      <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800">
        <span>{spec.label}</span>
        <input
          type="checkbox"
          className="accent-slate-950"
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
    ),
  };
}

function buildLinkField(spec: FieldSpec): CustomField<LinkTarget> {
  return {
    type: "custom",
    label: spec.label,
    render: ({ value, onChange }) => {
      const current: LinkTarget =
        value && typeof value === "object"
          ? {
              label: String(value.label ?? ""),
              href: String(value.href ?? "#"),
              style: value.style ?? "solid",
            }
          : { label: "Learn more", href: "#", style: "solid" };
      return (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
          <span className={adminLabelClass}>{spec.label}</span>
          <input
            className={adminInputClass}
            placeholder="Button label"
            value={current.label}
            onChange={(e) => onChange({ ...current, label: e.target.value })}
          />
          <input
            className={adminInputClass}
            placeholder="https://... or /path"
            value={current.href}
            onChange={(e) => onChange({ ...current, href: e.target.value })}
          />
          <select
            className={adminSelectClass}
            value={current.style ?? "solid"}
            onChange={(e) =>
              onChange({
                ...current,
                style: e.target.value as LinkTarget["style"],
              })
            }
          >
            <option value="solid">Solid accent</option>
            <option value="outline">Outline</option>
            <option value="ghost">Ghost</option>
            <option value="light">Light</option>
          </select>
        </div>
      );
    },
  };
}

function buildListField(spec: FieldSpec): CustomField<string[]> {
  return {
    type: "custom",
    label: spec.label,
    render: ({ value, onChange }) => {
      const lines = Array.isArray(value) ? value.join("\n") : "";
      return (
        <div className="space-y-1 py-1">
          <span className={adminLabelClass}>{spec.label} (one per line)</span>
          <textarea
            className={adminInputClass}
            rows={4}
            value={lines}
            onChange={(e) =>
              onChange(
                e.target.value
                  .split("\n")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
      );
    },
  };
}

function toPuckFields(
  specs: FieldSpec[],
  siteId: string,
  media: MediaOption[],
  onUploaded: (created: MediaOption) => void,
): Fields<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const spec of specs) {
    switch (spec.type) {
      case "text":
      case "color":
        out[spec.key] = { type: "text", label: spec.label };
        break;
      case "textarea":
      case "richtext":
        out[spec.key] = { type: "textarea", label: spec.label };
        break;
      case "number":
        out[spec.key] = {
          type: "number",
          label: spec.label,
          min: spec.min,
          max: spec.max,
        };
        break;
      case "select":
        out[spec.key] = {
          type: "select",
          label: spec.label,
          options: spec.options ?? [],
        };
        break;
      case "boolean":
        out[spec.key] = buildBooleanField(spec);
        break;
      case "image":
        out[spec.key] = buildImageField(spec, siteId, media, onUploaded);
        break;
      case "link":
        out[spec.key] = buildLinkField(spec);
        break;
      case "list":
        out[spec.key] = buildListField(spec);
        break;
      case "repeater":
        out[spec.key] = {
          type: "array",
          label: spec.label,
          defaultItemProps: spec.defaultItem ?? {},
          getItemSummary: (item: Record<string, unknown>, index = 0) =>
            spec.itemLabel
              ? spec.itemLabel(item, index)
              : String(
                  item.title ??
                    item.label ??
                    item.question ??
                    item.name ??
                    item.heading ??
                    item.value ??
                    `Item ${index + 1}`,
                ),
          arrayFields: toPuckFields(spec.fields ?? [], siteId, media, onUploaded),
        };
        break;
    }
  }
  return out as Fields<Record<string, unknown>>;
}

function toPuckComponent(
  definition: ComponentDefinition,
  siteId: string,
  media: MediaOption[],
  mediaLookup: Map<string, ResolvedMedia>,
  onUploaded: (created: MediaOption) => void,
) {
  const baseFields = toPuckFields(definition.fields, siteId, media, onUploaded);
  const appearanceFields = toPuckFields(APPEARANCE_FIELDS, siteId, media, onUploaded);

  return {
    label: definition.name,
    defaultProps: {
      ...definition.defaults,
      appearance: { ...DEFAULT_APPEARANCE },
    },
    fields: {
      ...baseFields,
      appearance: {
        type: "object",
        label: "Appearance",
        objectFields: appearanceFields,
      },
    } as Fields<Record<string, unknown>>,
    render: (rawProps: Record<string, unknown>) => {
      const { id: _id, puck: _puck, editMode: _editMode, ...rest } = rawProps;
      void _id;
      void _puck;
      void _editMode;
      const hydrated = resolveDocumentMedia(
        {
          schemaVersion: 1,
          root: { props: {} },
          content: [{ type: definition.alias, props: rest }],
        },
        mediaLookup,
      ).content[0]?.props ?? rest;
      const parsed = definition.schema.safeParse(hydrated);
      const props = parsed.success
        ? parsed.data
        : { ...definition.defaults, appearance: DEFAULT_APPEARANCE, ...hydrated };
      return <>{definition.render(props as never)}</>;
    },
  };
}

export function buildEditorConfig({
  theme,
  siteId,
  media,
  allowAdminBlocks,
  onUploaded,
}: {
  theme: SiteTheme;
  siteId: string;
  media: MediaOption[];
  allowAdminBlocks: boolean;
  onUploaded: (created: MediaOption) => void;
}): Config {
  const mediaLookup = new Map<string, ResolvedMedia>();
  for (const item of media) {
    const resolved: ResolvedMedia = {
      id: item.id,
      url: item.url,
      alt: item.alt ?? item.label,
    };
    mediaLookup.set(item.id, resolved);
  }

  const components: Record<string, ReturnType<typeof toPuckComponent>> = {};
  for (const definition of COMPONENT_LIST) {
    if (definition.deprecated) continue;
    components[definition.alias] = toPuckComponent(
      definition,
      siteId,
      media,
      mediaLookup,
      onUploaded,
    );
  }

  const categories = Object.fromEntries(
    GROUPS.map((group) => [
      group,
      {
        title: GROUP_LABELS[group],
        components: COMPONENT_LIST.filter(
          (item) =>
            !item.deprecated &&
            item.group === group &&
            (allowAdminBlocks || !item.adminOnly),
        ).map((item) => item.alias),
      },
    ]),
  );

  return {
    components,
    categories,
    root: {
      fields: {},
      defaultProps: {},
      render: ({ children }: { children: ReactNode }) => (
        <div className={`${themeRootClasses(theme)} min-h-screen`}>{children}</div>
      ),
    },
  };
}
