
export const DOCUMENT_SCHEMA_VERSION = 1;

export type BlockNode = {
  type: string;
  props: Record<string, unknown> & { id?: string };
};

export type PageRootProps = {
  contentWidth: "narrow" | "default" | "wide";
  background: "default" | "surface" | "dark";
  hideHeader?: boolean;
  hideFooter?: boolean;
  hideDock?: boolean;
};

export type PageDocument = {
  schemaVersion: number;
  root: { props: PageRootProps };
  content: BlockNode[];
  zones?: Record<string, BlockNode[]>;
};

export type PageSeo = {
  title?: string;
  description?: string;
  shareImageId?: string | null;
  ogTitle?: string;
  ogDescription?: string;
  keywords?: string;
  canonicalMode: "self" | "none" | "custom";
  canonicalUrl?: string;
  noindex: boolean;
};

export type SiteTheme = {
  accent: string;
  accentContrast: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  headingFont: string;
  bodyFont: string;
  radius: "sharp" | "soft" | "round";
  logoText: string;
  logoMediaId?: string | null;
  tagline?: string;
};

export const FONT_STACKS: Record<string, string> = {
  "system-sans": 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  "system-serif": 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  "geometric": '"Avenir Next", "Futura", "Century Gothic", ui-sans-serif, system-ui, sans-serif',
  "grotesk": '"Helvetica Neue", "Inter", "Segoe UI", Roboto, Arial, sans-serif',
  "mono": 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
};

export const RADIUS_TOKENS: Record<SiteTheme["radius"], { sm: string; md: string; lg: string }> = {
  sharp: { sm: "2px", md: "4px", lg: "6px" },
  soft: { sm: "6px", md: "10px", lg: "16px" },
  round: { sm: "10px", md: "16px", lg: "24px" },
};

export const DEFAULT_THEME: SiteTheme = {
  accent: "#c8a24a",
  accentContrast: "#111827",
  background: "#0b1120",
  surface: "#121a2b",
  text: "#f4f6fb",
  muted: "#9aa4bb",
  border: "#243049",
  headingFont: "system-sans",
  bodyFont: "system-sans",
  radius: "soft",
  logoText: "Trofeo",
  logoMediaId: null,
  tagline: "Rewards that keep players playing",
};

export const DEFAULT_SEO: PageSeo = {
  canonicalMode: "self",
  noindex: false,
};

export const DEFAULT_ROOT_PROPS: PageRootProps = {
  contentWidth: "default",
  background: "default",
};

export function emptyDocument(): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: { ...DEFAULT_ROOT_PROPS } },
    content: [],
  };
}

export type MediaRef = {
  id: string;
  url?: string;
  alt?: string;
  width?: number;
  height?: number;
};

export type PlaceholderSpec = {
  key: string;
  label: string;
  kind: "text" | "number" | "color" | "link" | "media";
  defaultValue: string;
};

export type ImportSegment = {
  id: string;
  index: number;
  label: string;
  excerpt: string;
  shape: {
    tag: string;
    headings: string[];
    paragraphs: number;
    buttons: number;
    images: number;
    repeatedChildren: number;
  };
  proposedAlias: string;
  confidence: number;
  props: Record<string, unknown>;
  assetUrls: string[];
  reason: string;
};

export type ImportUnmapped = {
  index: number;
  label: string;
  excerpt: string;
  reason: string;
};

export type ImportMapping = {
  schemaVersion: number;
  generatedAt: string;
  method: "deterministic" | "deterministic+llm";
  segments: ImportSegment[];
  unmapped: ImportUnmapped[];
  palette: string[];
  pageTitle: string;
  counts: { sections: number; mapped: number; unmapped: number };
};

export type ImportReviewDecision = {
  segmentId: string;
  decision: "accepted" | "remapped" | "removed";
  alias?: string;
  props?: Record<string, unknown>;
  decidedBy: string;
  decidedAt: string;
};

export type ImportReview = {
  decisions: ImportReviewDecision[];
  reviewerId: string;
  reviewerName: string;
  reviewedAt: string;
};

export function normalizeHostname(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

export function assertHostname(raw: string): string {
  const host = normalizeHostname(raw);
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(host)) {
    throw new Error("Enter a hostname without a scheme, for example offers.example.com");
  }
  if (host.startsWith("www.")) {
    throw new Error("Add the apex hostname (example.com); www is served automatically.");
  }
  return host;
}

export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizePath(raw: string): string {
  return raw.replace(/^\/+/, "").replace(/\/+$/, "").toLowerCase();
}

export function normalizeSlugPath(raw: string): string {
  return normalizePath(
    raw
      .split("/")
      .map((segment) => slugify(segment))
      .filter(Boolean)
      .join("/"),
  );
}

export function extractMediaIds(value: unknown, acc = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) extractMediaIds(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    if (typeof record.id === "string" && !("type" in record)) acc.add(record.id);
    for (const item of Object.values(record)) extractMediaIds(item, acc);
  }
  return acc;
}

export function replaceTokens(value: unknown, tokens: Record<string, string>): unknown {
  if (typeof value === "string") {
    return value.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) =>
      key in tokens ? tokens[key] : match,
    );
  }
  if (Array.isArray(value)) return value.map((item) => replaceTokens(item, tokens));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        replaceTokens(item, tokens),
      ]),
    );
  }
  return value;
}

export function collectTokens(value: unknown, acc = new Set<string>()): Set<string> {
  if (typeof value === "string") {
    for (const match of value.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)) acc.add(match[1]);
    return acc;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectTokens(item, acc);
    return acc;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectTokens(item, acc);
  }
  return acc;
}

export type ThemeCss = Record<string, string>;

export function themeCssVars(theme: SiteTheme): ThemeCss {
  const radius = RADIUS_TOKENS[theme.radius] ?? RADIUS_TOKENS.soft;
  return {
    "--site-accent": theme.accent,
    "--site-accent-contrast": theme.accentContrast,
    "--site-bg": theme.background,
    "--site-surface": theme.surface,
    "--site-text": theme.text,
    "--site-muted": theme.muted,
    "--site-border": theme.border,
    "--site-font-heading": FONT_STACKS[theme.headingFont] ?? FONT_STACKS["system-sans"],
    "--site-font-body": FONT_STACKS[theme.bodyFont] ?? FONT_STACKS["system-sans"],
    "--site-radius-sm": radius.sm,
    "--site-radius-md": radius.md,
    "--site-radius-lg": radius.lg,
  };
}
