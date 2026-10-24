import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { listSiteMedia, mediaPublicUrl } from "@/lib/media";
import { getSetting } from "@/lib/settings";
import { Panel } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/media-library";

export default async function SiteMediaPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const actor = await requireView("media.view", `/admin/sites/${siteId}/media`);
  const site = await getSite(siteId);
  if (!site) notFound();

  const [rows, maxUploadMb] = await Promise.all([
    listSiteMedia(siteId),
    getSetting("media.max_upload_mb"),
  ]);

  const assets = rows.map((row) => ({
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    byteSize: row.sizeBytes,
    width: row.width,
    height: row.height,
    altText: row.altText,
    url: mediaPublicUrl(row),
    createdAt: row.createdAt.toISOString(),
  }));

  return (
    <Panel
      title={`Media library (${assets.length})`}
      description="Site-scoped images with SHA-256 deduplication and reference-checked deletion."
    >
      <MediaLibrary
        siteId={siteId}
        assets={assets}
        canUpload={can(actor, "media.upload")}
        canDelete={can(actor, "media.delete")}
        maxBytes={maxUploadMb * 1024 * 1024}
      />
    </Panel>
  );
}
