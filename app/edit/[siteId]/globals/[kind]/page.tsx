import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { GLOBAL_INFO, getSiteContent } from "@/lib/globals";
import { GLOBAL_CONTENT_KINDS, type GlobalContentKind } from "@/lib/enums";
import { listSiteMedia, mediaPublicUrl } from "@/lib/media";
import { toPuckData } from "@/lib/puck-data";
import { PageEditor } from "@/components/editor/page-editor";

export const dynamic = "force-dynamic";

export default async function EditGlobalRoute({
  params,
}: {
  params: Promise<{ siteId: string; kind: string }>;
}) {
  const { siteId, kind } = await params;
  if (!(GLOBAL_CONTENT_KINDS as readonly string[]).includes(kind)) notFound();
  const globalKind = kind as GlobalContentKind;

  const actor = await requireView("globals.view", `/edit/${siteId}/globals/${kind}`);
  const site = await getSite(siteId);
  if (!site) notFound();

  const [content, mediaRows] = await Promise.all([
    getSiteContent(siteId, globalKind),
    listSiteMedia(siteId),
  ]);

  const media = mediaRows.map((row) => ({
    id: row.id,
    label: row.originalName,
    url: mediaPublicUrl(row),
    alt: row.altText,
  }));

  const info = GLOBAL_INFO[globalKind];

  return (
    <PageEditor
      siteId={site.id}
      siteName={site.name}
      mode={{
        kind: "global",
        globalKind,
        label: info.label,
      }}
      initialTitle={info.label}
      initialMeta={content.document.root?.props?.seo ?? {}}
      initialData={toPuckData(content.document)}
      initialLockVersion={content.lockVersion}
      theme={site.theme}
      media={media}
      canEdit={can(actor, "globals.edit")}
      canPublish={can(actor, "globals.publish")}
      allowAdminBlocks={can(actor, "catalog.admin_blocks")}
      previewUrl={`/preview/${site.id}/globals/${globalKind}`}
    />
  );
}
