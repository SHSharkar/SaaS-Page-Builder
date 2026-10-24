import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { getPage, getVersionById } from "@/lib/pages";
import { listSiteMedia, mediaPublicUrl } from "@/lib/media";
import { toPuckData } from "@/lib/puck-data";
import { PageEditor } from "@/components/editor/page-editor";

export const dynamic = "force-dynamic";

export default async function EditPageRoute({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const { siteId, pageId } = await params;
  const actor = await requireView("page.view", `/edit/${siteId}/${pageId}`);
  const site = await getSite(siteId);
  if (!site) notFound();
  const page = await getPage(siteId, pageId);
  if (!page) notFound();

  const [publishedVersion, mediaRows] = await Promise.all([
    page.publishedVersionId ? getVersionById(siteId, page.publishedVersionId) : null,
    listSiteMedia(siteId),
  ]);

  const media = mediaRows.map((row) => ({
    id: row.id,
    label: row.originalName,
    url: mediaPublicUrl(row),
    alt: row.altText,
  }));

  return (
    <PageEditor
      siteId={site.id}
      siteName={site.name}
      mode={{
        kind: "page",
        pageId: page.id,
        slug: page.slug,
        status: page.status,
        publishedVersionNumber: publishedVersion?.versionNumber ?? null,
        scheduledPublishAt: page.scheduledPublishAt?.toISOString() ?? null,
      }}
      initialTitle={page.title}
      initialMeta={page.seo}
      initialData={toPuckData(page.draftDocument)}
      initialLockVersion={page.lockVersion}
      theme={site.theme}
      media={media}
      canEdit={can(actor, "page.edit")}
      canPublish={can(actor, "page.publish")}
      allowAdminBlocks={can(actor, "catalog.admin_blocks")}
      previewUrl={`/preview/${site.id}/${page.id}`}
    />
  );
}
