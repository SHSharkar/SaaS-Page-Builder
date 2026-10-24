import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getSitePage } from "@/app/server/pages";
import { DocumentRenderer } from "@/components/blocks/document-renderer";
import { Stack, Text } from "@/components/ui";
import { parsePageDocument } from "@/lib/documents";

export default async function PageDraftPreviewPage({
  params,
}: {
  readonly params: Promise<{ pageId: string; siteId: string }>;
}) {
  const actor = await requireAccountPageCapability("pages.view");
  const { pageId, siteId } = await params;
  const page = await getSitePage(actor.account.id, siteId, pageId);
  if (!page) {
    notFound();
  }
  const doc = parsePageDocument(page.draftDocument, page.title);

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {page.title}
      </Text>
      <DocumentRenderer document={doc} />
    </Stack>
  );
}
