import { Fragment, type CSSProperties } from "react";
import { BLOCKS } from "@/lib/registry";
import {
  FONT_STACKS,
  RADIUS_TOKENS,
  type PageDocument,
  type PageSeo,
  type SiteTheme,
} from "@/lib/documents";
import type { ResolvedMedia } from "@/lib/media/refs";

export function themeStyle(theme: SiteTheme): CSSProperties {
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
  } as CSSProperties;
}

export function BlockRenderer({ document }: { document: PageDocument | null | undefined }) {
  if (!document?.content?.length) return null;
  return (
    <>
      {document.content.map((node, index) => {
        const definition = BLOCKS[node.type];
        if (!definition) return null;
        return <Fragment key={node.props?.id ?? `${node.type}-${index}`}>{definition.render(node.props as never)}</Fragment>;
      })}
    </>
  );
}

export function SiteFrame({
  site,
  theme,
  document,
  navigation,
  footer,
}: {
  site: { name: string };
  theme: SiteTheme;
  document: PageDocument;
  navigation: PageDocument | null;
  footer: PageDocument | null;
}) {
  const root = (document.root?.props ?? {}) as Record<string, unknown>;
  const width = String(root.contentWidth ?? "default");
  const background = String(root.background ?? "default");
  const widthClass =
    width === "narrow" ? "max-w-[820px]" : width === "wide" ? "max-w-[1400px]" : "max-w-[1160px]";
  const backgroundStyle: CSSProperties =
    background === "dark"
      ? { background: "#05080f" }
      : background === "surface"
        ? { background: "var(--site-surface)" }
        : {};

  return (
    <div className="site-scope flex min-h-screen flex-col" style={{ ...themeStyle(theme), ...backgroundStyle }}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:text-black"
      >
        Skip to content
      </a>
      {root.hideHeader ? null : <BlockRenderer document={navigation} />}
      <main id="main" className="flex-1">
        <div className={`mx-auto w-full ${widthClass} px-5`}>
          <BlockRenderer document={document} />
        </div>
      </main>
      {root.hideFooter ? null : <BlockRenderer document={footer} />}
      <span className="sr-only">{site.name}</span>
    </div>
  );
}

export type PageMetadataInput = {
  title: string;
  seo: PageSeo;
  theme: SiteTheme;
  siteName: string;
  host: string;
  path: string;
  shareImageUrl?: string | null;
  defaults?: PageDocument | null;
  noindex?: boolean;
};

export function buildMetadata(input: PageMetadataInput) {
  const defaultsSeo = ((input.defaults?.root?.props as Record<string, unknown> | undefined)?.seo ??
    {}) as Partial<PageSeo>;
  const seo = { ...defaultsSeo, ...input.seo };
  const title = seo.title?.trim() || `${input.title} · ${input.siteName}`;
  const description = seo.description?.trim() || defaultsSeo.description?.trim() || input.theme.tagline;
  const ogTitle = seo.ogTitle?.trim() || title;
  const ogDescription = seo.ogDescription?.trim() || description;
  const canonical =
    seo.canonicalMode === "custom" && seo.canonicalUrl
      ? seo.canonicalUrl
      : seo.canonicalMode === "none"
        ? undefined
        : `https://${input.host}/${input.path}`.replace(/\/$/, "") || `https://${input.host}`;
  const noindex = input.noindex ?? seo.noindex;

  return {
    title: { absolute: title },
    description,
    alternates: canonical ? { canonical } : undefined,
    robots: noindex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      siteName: input.siteName,
      type: "website" as const,
      url: canonical,
      images: input.shareImageUrl ? [{ url: input.shareImageUrl }] : undefined,
    },
    twitter: {
      card: "summary_large_image" as const,
      title: ogTitle,
      description: ogDescription,
      images: input.shareImageUrl ? [input.shareImageUrl] : undefined,
    },
  };
}

export function mediaUrl(media: Map<string, ResolvedMedia>, id: string | null | undefined): string | null {
  if (!id) return null;
  return media.get(id)?.url ?? null;
}
