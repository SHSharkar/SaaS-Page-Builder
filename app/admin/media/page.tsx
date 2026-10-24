import { listPlatformRecordsSummary } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";
import { formatByteSize } from "@/lib/byte-size";

export default async function AdminMediaPage() {
  await requirePlatformPageCapability("platform.console.view");
  const summary = await listPlatformRecordsSummary();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.mediaHeading")}
      </Text>
      <Stack gap="sm">
        {summary.media.map((asset) => {
          const sizeLabel = formatByteSize(asset.sizeBytes);
          return (
            <Surface key={asset.id}>
              <Stack align="between" direction="row" gap="sm">
                <Text as="h2" variant="subheading">
                  {asset.originalName}
                </Text>
                <Badge>{sizeLabel}</Badge>
              </Stack>
            </Surface>
          );
        })}
      </Stack>
    </Stack>
  );
}
