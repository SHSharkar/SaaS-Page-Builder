import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { loadPublicPage } from "@/lib/public-page";
import { SiteFrame, buildMetadata } from "@/lib/render";

export const dynamic = "force-dynamic";

async function requestHost(): Promise<string> {
  const headerBag = await headers();
  return (
    headerBag.get("x-forwarded-host")?.split(",")[0]?.trim() ??
    headerBag.get("host") ??
    "localhost:3000"
  );
}

export async function generateMetadata({ params }: { params: Promise<{ path?: string[] }> }): Promise<Metadata> {
  const { path = [] } = await params;
  const loaded = await loadPublicPage(await requestHost(), path.join("/"));
  if (loaded.kind !== "page") {
    return { title: "Page not found", robots: { index: false, follow: false } };
  }
  return buildMetadata({
    title: loaded.rendered.title,
    seo: loaded.rendered.seo,
    defaults: loaded.defaultSeo ? ({ root: { props: { seo: loaded.defaultSeo } }, content: [] } as never) : null,
    theme: loaded.theme,
    siteName: loaded.rendered.site.name,
    host: loaded.rendered.host,
    path: loaded.rendered.path,
    shareImageUrl: loaded.rendered.shareImageUrl,
  });
}

export default async function PublicPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await params;
  const loaded = await loadPublicPage(await requestHost(), path.join("/"));
  if (loaded.kind !== "page") notFound();

  return (
    <SiteFrame
      site={{ name: loaded.rendered.site.name }}
      theme={loaded.theme}
      document={loaded.rendered.document}
      navigation={loaded.navigation}
      footer={loaded.footer}
    />
  );
}
