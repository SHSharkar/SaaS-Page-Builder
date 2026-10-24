import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listSiteMedia } from "@/app/server/media";
import { getAccountSite } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";
import { formatByteSize } from "@/lib/byte-size";

export default async function SiteMediaPage({
  params,
}: {
  readonly params: Promise<{ siteId: string }>;
}) {
  const actor = await requireAccountPageCapability("media.view");
  const { siteId } = await params;
  const site = await getAccountSite(actor.account.id, siteId);
  if (!site) {
    notFound();
  }
  const assets = await listSiteMedia(actor.account.id, site.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {`${site.name} - ${t("media.heading")}`}
      </Text>
      <div className="grid gap-4 md:grid-cols-3">
        {assets.map((asset) => {
          const sizeLabel = formatByteSize(asset.sizeBytes);
          return (
            <Surface key={asset.id}>
              <Stack gap="sm">
                <Text as="h2" variant="subheading">
                  {asset.originalName}
                </Text>
                <Badge>{sizeLabel}</Badge>
              </Stack>
            </Surface>
          );
        })}
      </div>
    </Stack>
  );
}
