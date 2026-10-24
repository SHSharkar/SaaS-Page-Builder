import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { getPage, getVersionById } from "@/lib/pages";
import { getSiteGlobals } from "@/lib/globals";
import { mediaMapFor } from "@/lib/media";
import { resolveDocumentMedia } from "@/lib/registry";
import { SiteFrame } from "@/lib/render";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { siteId, pageId } = await params;
  const { version: versionId } = await searchParams;
  await requireView("page.preview", `/preview/${siteId}/${pageId}`);

  const site = await getSite(siteId);
  if (!site) notFound();
  const page = await getPage(siteId, pageId);
  if (!page) notFound();

  const snapshot = versionId ? await getVersionById(siteId, versionId) : null;
  if (versionId && (!snapshot || snapshot.pageId !== page.id)) notFound();

  const rawDocument = snapshot ? snapshot.document : page.draftDocument;
  const [globals, media] = await Promise.all([getSiteGlobals(siteId), mediaMapFor(siteId)]);

  const document = resolveDocumentMedia(rawDocument, media);
  const navRaw = globals.navigation?.draftDocument ?? globals.navigation?.publishedDocument ?? null;
  const footRaw = globals.footer?.draftDocument ?? globals.footer?.publishedDocument ?? null;
  const navigation = navRaw ? resolveDocumentMedia(navRaw, media) : null;
  const footer = footRaw ? resolveDocumentMedia(footRaw, media) : null;

  return (
    <div>
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-amber-400 px-4 py-2 text-xs font-medium text-slate-950">
        <span>
          Staff preview | {site.name} / {page.title}{" "}
          {snapshot ? `(version v${snapshot.versionNumber})` : "(working draft)"}
        </span>
        <div className="flex items-center gap-3">
          <Link href={`/edit/${site.id}/${page.id}`} className="font-semibold underline">
            Open in editor
          </Link>
          <Link href={`/admin/sites/${site.id}/pages/${page.id}`} className="underline">
            Page details
          </Link>
        </div>
      </div>
      <SiteFrame
        site={{ name: site.name }}
        theme={site.theme}
        document={document}
        navigation={navigation}
        footer={footer}
      />
    </div>
  );
}
