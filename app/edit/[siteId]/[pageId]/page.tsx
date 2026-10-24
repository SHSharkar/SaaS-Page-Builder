import { notFound, redirect } from "next/navigation";
import { requireActor, can } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { getPage } from "@/lib/pages";
import { mediaMapFor } from "@/lib/media";
import { PageEditor } from "@/components/editor/page-editor";
import { withPuckIds } from "@/lib/puck-data";

export const dynamic = "force-dynamic";

export default async function EditPage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const actor = await requireActor();
  const { siteId, pageId } = await params;
  const site = await getSite(siteId);
  if (!site) notFound();
  const page = await getPage(siteId, pageId);
  if (!page) notFound();

  if (!can(actor, "editor")) {
    redirect(`/preview/${siteId}/${page.slug}`);
  }

  const media = await mediaMapFor(siteId);

  return (
    <PageEditor
      siteId={siteId}
      siteName={site.name}
      pageId={page.id}
      title={page.title}
      slug={page.slug}
      status={page.status}
      lockVersion={page.lockVersion}
      document={withPuckIds(page.draftDocument)}
      theme={site.theme}
      media={[...media.values()]}
      scope="page"
      previewHref={`/preview/${siteId}/${page.slug}`}
      historyHref={`/admin/sites/${siteId}/pages/${page.id}`}
      canPublish={can(actor, "editor")}
    />
  );
}
