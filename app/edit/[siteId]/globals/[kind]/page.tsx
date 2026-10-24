import { notFound, redirect } from "next/navigation";
import { requireActor, can } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { getSiteContent, GLOBAL_LABELS, type GlobalKind } from "@/lib/globals";
import { mediaMapFor } from "@/lib/media";
import { PageEditor } from "@/components/editor/page-editor";
import { emptyDocument } from "@/lib/documents";
import { withPuckIds } from "@/lib/puck-data";

export const dynamic = "force-dynamic";

const KINDS: GlobalKind[] = ["navigation", "footer", "defaults"];

export default async function EditGlobalsPage({
  params,
}: {
  params: Promise<{ siteId: string; kind: string }>;
}) {
  const actor = await requireActor();
  const { siteId, kind } = await params;
  if (!KINDS.includes(kind as GlobalKind)) notFound();
  if (!can(actor, "editor")) redirect(`/admin/sites/${siteId}/globals`);
  if (kind === "defaults") redirect(`/admin/sites/${siteId}/globals/defaults`);

  const site = await getSite(siteId);
  if (!site) notFound();

  const globalKind = kind as GlobalKind;
  const content = await getSiteContent(siteId, globalKind);
  const media = await mediaMapFor(siteId);
  const document = withPuckIds(content?.draftDocument ?? content?.publishedDocument ?? emptyDocument());

  return (
    <PageEditor
      siteId={siteId}
      siteName={site.name}
      pageId={content?.id ?? `${siteId}-${globalKind}`}
      title={GLOBAL_LABELS[globalKind]}
      slug={globalKind}
      status={content?.publishedDocument ? "published" : "draft"}
      publishedAt={content?.publishedAt ? content.publishedAt.toISOString() : null}
      lockVersion={content?.lockVersion ?? 0}
      document={document}
      theme={site.theme}
      media={[...media.values()]}
      scope={globalKind}
      previewHref={`/preview/${siteId}/`}
      canPublish={can(actor, "editor")}
    />
  );
}
