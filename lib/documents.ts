import { z } from "zod";
import { ValidationError } from "./errors";

export const DOCUMENT_SCHEMA_VERSION = 1;
export const MAX_DOCUMENT_CHARS = 200_000;

export interface MediaRef {
  id: string;
  url?: string;
  alt?: string;
  focalPoint?: { x: number; y: number };
}

export interface LinkTarget {
  label: string;
  href: string;
  placement?: string;
  newTab?: boolean;
  style?: "solid" | "outline" | "ghost" | "light";
}

export interface BlockAppearance {
  background?: "inherit" | "default" | "surface" | "elevated" | "accent" | "muted" | "dark" | "light" | "transparent";
  foreground?: "default" | "muted" | "contrast";
  spacing?: "none" | "sm" | "md" | "lg" | "xl";
  width?: "narrow" | "default" | "wide" | "full";
  align?: "left" | "center" | "right";
  corners?: "none" | "sm" | "md" | "lg";
  visibility?: "all" | "desktop" | "mobile";
  anchor?: string;
}

export interface BlockNode {
  type: string;
  props: Record<string, unknown> & {
    id?: string;
    appearance?: BlockAppearance;
  };
}

export const pageSeoSchema = z.object({
  title: z.string().max(120).optional(),
  metaTitle: z.string().max(120).optional(),
  description: z.string().max(320).optional(),
  metaDescription: z.string().max(320).optional(),
  ogTitle: z.string().max(120).optional(),
  ogDescription: z.string().max(320).optional(),
  shareImageId: z.string().uuid().nullable().optional(),
  canonicalMode: z.enum(["self", "none", "custom"]).default("self"),
  canonicalUrl: z.string().max(500).optional(),
  noindex: z.boolean().default(false),
  keywords: z.string().max(300).optional(),
});

export type PageSeo = {
  title?: string;
  metaTitle?: string;
  description?: string;
  metaDescription?: string;
  ogTitle?: string;
  ogDescription?: string;
  shareImageId?: string | null;
  canonicalMode?: "self" | "none" | "custom";
  canonicalUrl?: string;
  noindex?: boolean;
  keywords?: string;
};

export type DocumentMeta = Partial<PageSeo>;

export const DEFAULT_SEO: PageSeo = {
  canonicalMode: "self",
  noindex: false,
};

export interface PageDocument {
  schemaVersion: number;
  root: {
    props: {
      id?: string;
      title?: string;
      background?: "default" | "surface" | "dark";
      contentWidth?: "narrow" | "default" | "wide";
      hideHeader?: boolean;
      hideFooter?: boolean;
      hideDock?: boolean;
      seo?: Partial<PageSeo>;
    };
  };
  content: BlockNode[];
  zones?: Record<string, BlockNode[]>;
}

export const DEFAULT_ROOT_PROPS: PageDocument["root"]["props"] = {
  background: "default",
  contentWidth: "default",
  hideHeader: false,
  hideFooter: false,
  hideDock: false,
};

export function emptyDocument(): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: { ...DEFAULT_ROOT_PROPS } },
    content: [],
  };
}

export function newBlockId(prefix = "blk"): string {
  const safe = prefix.replace(/[^a-z0-9-]/gi, "").slice(0, 20) || "blk";
  return `${safe}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
}

export function migrateDocument(input: unknown): PageDocument {
  if (!input || typeof input !== "object") {
    return emptyDocument();
  }
  const raw = input as Partial<PageDocument> & {
    blocks?: { id?: string; type: string; props?: Record<string, unknown> }[];
    meta?: Partial<PageSeo>;
  };
  const contentSource = Array.isArray(raw.content)
    ? raw.content
    : Array.isArray(raw.blocks)
      ? raw.blocks.map((b) => ({
          type: b.type,
          props: { ...(b.props ?? {}), id: b.id ?? b.props?.id ?? newBlockId(b.type) },
        }))
      : [];

  const rootProps: PageDocument["root"]["props"] = {
    ...DEFAULT_ROOT_PROPS,
    ...(raw.root?.props ?? {}),
    ...(raw.meta ? { seo: { ...(raw.root?.props?.seo ?? {}), ...raw.meta } } : {}),
  };

  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: rootProps },
    content: contentSource.map((node) => ({
      type: String(node.type ?? ""),
      props: {
        ...(node.props ?? {}),
        id:
          typeof node.props?.id === "string" && node.props.id.trim()
            ? node.props.id
            : newBlockId(String(node.type ?? "blk")),
      },
    })),
    ...(raw.zones && typeof raw.zones === "object" ? { zones: raw.zones } : {}),
  };
}

export const parseDocument = migrateDocument;

export function cloneDocumentWithNewIds(doc: PageDocument): PageDocument {
  const cloned = JSON.parse(JSON.stringify(migrateDocument(doc))) as PageDocument;
  cloned.content = cloned.content.map((node) => ({
    type: node.type,
    props: {
      ...node.props,
      id: newBlockId(node.type),
    },
  }));
  return cloned;
}

export function assertDocumentSize(doc: PageDocument): void {
  const ordered: PageDocument = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: doc.root,
    content: doc.content,
    ...(doc.zones ? { zones: doc.zones } : {}),
  };
  const serialized = JSON.stringify(ordered);
  if (serialized.length > MAX_DOCUMENT_CHARS) {
    throw new ValidationError(
      `Page document exceeds the ${MAX_DOCUMENT_CHARS.toLocaleString("en-US")} character limit.`,
    );
  }
}

export function sanitizeRichHtml(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<(object|embed|form|input|button)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(object|embed|form|input|button)[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src|xlink:href)\s*=\s*["']\s*(javascript:|vbscript:|data:text\/html)[^"']*["']/gi, "");
}

export const siteThemeSchema = z.object({
  palette: z
    .enum(["obsidian-gold", "emerald-casino", "midnight-neon", "ivory-editorial"])
    .optional(),
  fontPair: z.enum(["editorial", "geometric", "classic", "modern"]).optional(),
  accent: z.string().default("#c8a24a"),
  accentContrast: z.string().default("#0b1120"),
  background: z.string().default("#0b1120"),
  surface: z.string().default("#131b2e"),
  text: z.string().default("#f4f6fb"),
  ink: z.string().optional(),
  muted: z.string().default("#9aa4bb"),
  border: z.string().default("#202b44"),
  headingFont: z.enum(["editorial", "modern", "geometric", "mono"]).default("editorial"),
  bodyFont: z.enum(["modern", "editorial", "geometric", "mono"]).default("modern"),
  radius: z.enum(["sharp", "soft", "round", "rounded", "pill"]).default("soft"),
  logoMediaId: z.string().nullable().default(null),
  logoText: z.string().default("Trofeo"),
  tagline: z.string().default(""),
});

export type SiteTheme = z.infer<typeof siteThemeSchema>;

export const DEFAULT_THEME: SiteTheme = siteThemeSchema.parse({});

export const FONT_STACKS: Record<string, string> = {
  editorial: "'Fraunces', 'Iowan Old Style', Georgia, serif",
  modern: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  geometric: "'Space Grotesk', 'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
};

export interface TemplatePlaceholder {
  key: string;
  label: string;
  defaultValue: string;
  hint?: string;
  kind: "text" | "url" | "color" | "number";
}

export interface ImportSegment {
  id: string;
  index: number;
  label: string;
  sourceTag: string;
  excerpt: string;
  rawHtml: string;
  suggestedType: string | null;
  confidence: number;
  props: Record<string, unknown>;
  decision: "accept" | "remap" | "skip" | "raw_html";
}

export interface ImportReport {
  title: string;
  mappedCount: number;
  unmappedCount: number;
  strippedCount: number;
  imagesImported: number;
  imagesSkipped: number;
  warnings: string[];
  segments: ImportSegment[];
}

export interface ImportReviewDecision {
  segmentId: string;
  decision: "accepted" | "remapped" | "removed" | "raw_html";
  alias?: string;
  props?: Record<string, unknown>;
  decidedBy: string;
  decidedAt: string;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9/]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/(^[-/]+|[-/]+$)/g, "")
    .replace(/-\//g, "/")
    .replace(/\/-/g, "/");
}

export function normalizePageSlug(raw: string): string {
  const cleaned = slugify(raw);
  return cleaned || "home";
}

export function normalizePath(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed === "/") return "/";
  const cleaned = slugify(trimmed);
  return cleaned ? `/${cleaned}` : "/";
}

export function normalizeHostname(raw: string | null | undefined): string {
  if (!raw) return "";
  let host = raw.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "");
  host = host.split("/")[0] ?? "";
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    return end >= 0 ? host.slice(0, end + 1) : host;
  }
  host = host.replace(/:\d+$/, "").replace(/\.+$/, "");
  return host;
}

export function assertHostname(raw: string): string {
  const host = normalizeHostname(raw);
  if (!host || host.length > 253) {
    throw new ValidationError("Enter a valid domain name such as www.brand.example.");
  }
  if (
    host === "localhost" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) ||
    host.includes(":")
  ) {
    throw new ValidationError("Custom domains must be public DNS hostnames, not IP addresses or localhost.");
  }
  const labels = host.split(".");
  if (labels.length < 2) {
    throw new ValidationError("Enter a fully qualified domain name with at least one dot.");
  }
  for (const label of labels) {
    if (
      !label ||
      label.length > 63 ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
    ) {
      throw new ValidationError(`"${raw}" is not a valid DNS hostname.`);
    }
  }
  return host;
}
