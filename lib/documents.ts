import { z } from "zod";

export const DOCUMENT_SCHEMA_VERSION = 1;
export const MAX_DOCUMENT_BYTES = 200 * 1024;

export const THEME_PALETTES = [
  "obsidian-gold",
  "emerald-studio",
  "midnight-cobalt",
  "ivory-editorial",
] as const;

export type ThemePalette = (typeof THEME_PALETTES)[number];

export interface SiteTheme {
  palette: ThemePalette;
  logoText: string;
  logoMediaId?: string | null;
  accentHex: string;
  fontFamily: "sans" | "editorial" | "geometric";
}

export const DEFAULT_SITE_THEME: SiteTheme = {
  palette: "obsidian-gold",
  logoText: "SaaS Page Builder",
  logoMediaId: null,
  accentHex: "#1d4ed8",
  fontFamily: "sans",
};

export interface PageSeo {
  metaTitle: string;
  metaDescription: string;
  canonicalUrl?: string;
  ogImageMediaId?: string | null;
  noIndex: boolean;
}

export const DEFAULT_PAGE_SEO: PageSeo = {
  metaTitle: "",
  metaDescription: "",
  noIndex: false,
};

export interface BlockAppearance {
  background: "default" | "muted" | "accent" | "contrast";
  spacing: "compact" | "normal" | "spacious";
  width: "narrow" | "normal" | "wide" | "full";
  align: "left" | "center";
  visibility: "all" | "desktop" | "mobile";
  anchorId: string;
}

export interface BlockNode {
  id: string;
  type: string;
  props: Record<string, unknown>;
  appearance?: Partial<BlockAppearance>;
}

export interface PageDocument {
  schemaVersion: number;
  root: {
    title: string;
    description?: string;
  };
  content: BlockNode[];
}

export interface TemplatePlaceholder {
  key: string;
  label: string;
  defaultValue: string;
}

export interface ImportSegment {
  id: string;
  tagName: string;
  heading: string;
  textPreview: string;
  suggestedBlockType: string;
  rawHtml: string;
  proposedProps: Record<string, unknown>;
}

export interface ImportReport {
  title: string;
  description: string;
  segmentCount: number;
  warnings: string[];
  segments: ImportSegment[];
}

export interface ImportReviewDecision {
  segmentId: string;
  action: "accept" | "remap" | "raw" | "skip";
  blockType?: string;
}

export const blockNodeSchema = z.object({
  id: z.string().min(1).max(120),
  type: z.string().min(1).max(80),
  props: z.record(z.string(), z.unknown()),
  appearance: z
    .object({
      background: z.enum(["default", "muted", "accent", "contrast"]).optional(),
      spacing: z.enum(["compact", "normal", "spacious"]).optional(),
      width: z.enum(["narrow", "normal", "wide", "full"]).optional(),
      align: z.enum(["left", "center"]).optional(),
      visibility: z.enum(["all", "desktop", "mobile"]).optional(),
      anchorId: z.string().max(80).optional(),
    })
    .optional(),
});

export const pageDocumentSchema = z.object({
  schemaVersion: z.number().int().min(1),
  root: z.object({
    title: z.string().max(200),
    description: z.string().max(500).optional(),
  }),
  content: z.array(blockNodeSchema).max(200),
});

export function emptyDocument(title = "Home"): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { title },
    content: [],
  };
}

export function parsePageDocument(
  raw: unknown,
  fallbackTitle = "Home",
): PageDocument {
  const parsed = pageDocumentSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyDocument(fallbackTitle);
}

export function assertDocumentSize(doc: PageDocument): void {
  const encoded = new TextEncoder().encode(JSON.stringify(doc));
  if (encoded.byteLength > MAX_DOCUMENT_BYTES) {
    throw new Error("Document exceeds the 200 KB JSONB limit");
  }
}

export function slugify(input: string): string {
  const cleaned = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return cleaned || "untitled";
}

export function normalizePath(rawPath: string): string {
  const trimmed = rawPath.trim().split("?")[0]?.split("#")[0] ?? "/";
  if (!trimmed || trimmed === "/") {
    return "/";
  }
  const segments = trimmed
    .split("/")
    .map((part) => slugify(part))
    .filter((part) => part.length > 0 && part !== "untitled");
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

export function normalizeHostname(rawHost: string): string {
  const withoutPort = rawHost
    .trim()
    .toLowerCase()
    .replace(/\.$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (
    !withoutPort ||
    withoutPort.length > 253 ||
    !/^[a-z0-9.-]+$/.test(withoutPort) ||
    withoutPort.startsWith("-") ||
    withoutPort.endsWith("-")
  ) {
    return "";
  }
  return withoutPort;
}

export function cloneDocumentWithNewIds(doc: PageDocument): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { ...doc.root },
    content: doc.content.map((node, index) => ({
      id: `blk_${index + 1}_${crypto.randomUUID().slice(0, 8)}`,
      type: node.type,
      props: structuredClone(node.props),
      appearance: node.appearance ? { ...node.appearance } : undefined,
    })),
  };
}
