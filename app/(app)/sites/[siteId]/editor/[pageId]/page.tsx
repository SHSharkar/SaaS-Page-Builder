import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getSitePage } from "@/app/server/pages";
import { PageStudioClient } from "@/components/editor/page-studio-client";
import { parsePageDocument } from "@/lib/documents";

export default async function PageEditorPage({
  params,
}: {
  readonly params: Promise<{ pageId: string; siteId: string }>;
}) {
  const actor = await requireAccountPageCapability("pages.edit");
  const { pageId, siteId } = await params;
  const page = await getSitePage(actor.account.id, siteId, pageId);
  if (!page) {
    notFound();
  }

  const initialDocument = parsePageDocument(page.draftDocument, page.title);

  return (
    <PageStudioClient
      initialDocument={initialDocument}
      initialLockVersion={page.lockVersion}
      initialTitle={page.title}
      pageId={page.id}
      pageSlug={page.slug}
      pageStatus={page.status}
      siteId={siteId}
    />
  );
}
