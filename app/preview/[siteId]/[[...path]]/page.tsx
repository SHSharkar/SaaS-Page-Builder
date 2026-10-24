import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { loadPreviewPage } from "@/lib/public-page";
import { SiteFrame, buildMetadata } from "@/lib/render";
import { getSite } from "@/lib/sites";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Staff preview",
  robots: { index: false, follow: false, nocache: true },
};

export default async function PreviewPage({
  params,
}: {
  params: Promise<{ siteId: string; path?: string[] }>;
}) {
  const { siteId, path = [] } = await params;
  const actor = await getActor();
  if (!actor) redirect(`/sign-in?next=/preview/${siteId}`);
  if (actor.user.status !== "active") notFound();

  const site = await getSite(siteId);
  if (!site) notFound();

  const loaded = await loadPreviewPage(siteId, path.join("/"));
  if (loaded.kind !== "page") notFound();

  const meta = buildMetadata({
    title: loaded.rendered.title,
    seo: { ...loaded.rendered.seo, noindex: true },
    defaults: null,
    theme: loaded.theme,
    siteName: site.name,
    host: "preview.local",
    path: loaded.rendered.path,
  });

  return (
    <div>
      <title>{`${meta.title} · preview`}</title>
      <meta name="robots" content="noindex, nofollow, nocache" />
      <SiteFrame
        site={{ name: site.name }}
        theme={loaded.theme}
        document={loaded.rendered.document}
        navigation={loaded.navigation}
        footer={loaded.footer}
      />
      <div className="fixed bottom-3 left-3 z-50 flex flex-wrap items-center gap-2 rounded-full border border-white/20 bg-black/85 px-3.5 py-1.5 text-[11px] font-medium text-white shadow-lg backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden="true" />
        <span>Draft preview · noindex · {site.name}</span>
        <span className="text-white/30" aria-hidden="true">
          |
        </span>
        <Link href={`/edit/${siteId}/${loaded.rendered.page.id}`} className="underline">
          Open editor
        </Link>
        <span className="text-white/30" aria-hidden="true">
          |
        </span>
        <Link href={`/admin/sites/${siteId}/pages/${loaded.rendered.page.id}`} className="underline">
          Page settings
        </Link>
      </div>
    </div>
  );
}
