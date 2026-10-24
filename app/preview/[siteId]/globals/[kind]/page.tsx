import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { GLOBAL_INFO, getSiteGlobals } from "@/lib/globals";
import { GLOBAL_CONTENT_KINDS, type GlobalContentKind } from "@/lib/enums";
import { mediaMapFor } from "@/lib/media";
import { parseDocument } from "@/lib/documents";
import { resolveDocumentMedia } from "@/lib/registry";
import { SiteFrame } from "@/lib/render";

export const dynamic = "force-dynamic";

export default async function PreviewGlobalPage({
  params,
}: {
  params: Promise<{ siteId: string; kind: string }>;
}) {
  const { siteId, kind } = await params;
  if (!(GLOBAL_CONTENT_KINDS as readonly string[]).includes(kind)) notFound();
  const globalKind = kind as GlobalContentKind;
  await requireView("globals.view", `/preview/${siteId}/globals/${kind}`);

  const site = await getSite(siteId);
  if (!site) notFound();

  const [globals, media] = await Promise.all([getSiteGlobals(siteId), mediaMapFor(siteId)]);
  const info = GLOBAL_INFO[globalKind];

  const placeholderDoc = parseDocument({
    schemaVersion: 1,
    content: [
      {
        type: "rich-text",
        props: {
          id: "preview-note",
          eyebrow: "Global content preview",
          title: `Previewing ${info.label}`,
          html: "<p>Header and footer regions surround every published page on this site. Changes published in the global editor take effect across all live pages immediately.</p>",
        },
      },
    ],
  });

  const navRaw = globals.navigation?.draftDocument ?? globals.navigation?.publishedDocument ?? null;
  const footRaw = globals.footer?.draftDocument ?? globals.footer?.publishedDocument ?? null;
  const navigation = navRaw ? resolveDocumentMedia(navRaw, media) : null;
  const footer = footRaw ? resolveDocumentMedia(footRaw, media) : null;

  return (
    <div>
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-amber-400 px-4 py-2 text-xs font-medium text-slate-950">
        <span>
          Staff preview | {site.name} / {info.label}
        </span>
        <Link href={`/edit/${site.id}/globals/${globalKind}`} className="font-semibold underline">
          Return to global editor
        </Link>
      </div>
      <SiteFrame
        site={{ name: site.name }}
        theme={site.theme}
        document={placeholderDoc}
        navigation={navigation}
        footer={footer}
      />
    </div>
  );
}
