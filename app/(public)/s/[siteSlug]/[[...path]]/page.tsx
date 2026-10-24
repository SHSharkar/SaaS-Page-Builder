import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolvePublishedPage } from "@/app/server/public-site";
import { DocumentRenderer } from "@/components/blocks/document-renderer";
import { Stack, Text } from "@/components/ui";
import { DOMAIN_ID_HEADER } from "@/proxy";

export const dynamic = "force-dynamic";

function resolvePageSlug(segments?: string[]): string {
  if (!segments || segments.length === 0) {
    return "/";
  }
  return `/${segments.join("/")}`;
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ path?: string[]; siteSlug: string }>;
}): Promise<Metadata> {
  const { path, siteSlug } = await params;
  const hdrs = await headers();
  const customHost = hdrs.get(DOMAIN_ID_HEADER);
  const snapshot = await resolvePublishedPage({
    hostname: siteSlug === "_custom" ? customHost : null,
    pageSlug: resolvePageSlug(path),
    siteSlug: siteSlug === "_custom" ? null : siteSlug,
  });
  if (!snapshot) {
    return { title: "Not Found" };
  }
  return {
    title:
      snapshot.seo.metaTitle || `${snapshot.pageTitle} - ${snapshot.siteName}`,
    description: snapshot.seo.metaDescription,
    robots: snapshot.seo.noIndex ? "noindex, nofollow" : "index, follow",
  };
}

export default async function PublishedSitePage({
  params,
}: {
  readonly params: Promise<{ path?: string[]; siteSlug: string }>;
}) {
  const { path, siteSlug } = await params;
  const hdrs = await headers();
  const customHost = hdrs.get(DOMAIN_ID_HEADER);
  const snapshot = await resolvePublishedPage({
    hostname: siteSlug === "_custom" ? customHost : null,
    pageSlug: resolvePageSlug(path),
    siteSlug: siteSlug === "_custom" ? null : siteSlug,
  });

  if (!snapshot) {
    notFound();
  }

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {snapshot.pageTitle}
      </Text>
      <DocumentRenderer
        document={snapshot.document}
        footerDocument={snapshot.footerDocument}
        navDocument={snapshot.navDocument}
      />
    </Stack>
  );
}
