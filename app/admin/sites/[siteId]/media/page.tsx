import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { listMedia, MAX_IMAGE_BYTES } from "@/lib/media";
import { requireView } from "@/lib/auth/session";
import { PageHeader, Panel } from "@/components/admin/ui";
import { MediaLibrary } from "@/components/admin/media-library";

export const dynamic = "force-dynamic";

export default async function SiteMediaPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireView("media.view");
  const site = await getSite(siteId);
  if (!site) notFound();
  const assets = await listMedia(siteId);

  return (
    <div>
      <PageHeader
        title="Media"
        description="Images live in the site library, stored by content hash. Documents reference image ids, so deleting one is refused while a page still uses it."
        breadcrumb={[{ label: site.name, href: `/admin/sites/${siteId}` }, { label: "Media" }]}
      />
      <Panel
        title={`${assets.length} image${assets.length === 1 ? "" : "s"}`}
        description={`Each file is byte-verified against its claimed type and capped at ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`}
      >
        <MediaLibrary
          siteId={siteId}
          assets={assets.map((asset) => ({
            id: asset.id,
            publicUrl: asset.publicUrl,
            altText: asset.altText,
            mimeType: asset.mimeType,
            sizeBytes: asset.sizeBytes,
            width: asset.width,
            height: asset.height,
            createdAt: asset.createdAt.toISOString(),
          }))}
        />
      </Panel>
    </div>
  );
}
