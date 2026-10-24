import { listPlatformRecordsSummary } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";
import { formatByteSize } from "@/lib/byte-size";

export default async function AdminBackupsPage() {
  await requirePlatformPageCapability("platform.console.view");
  const summary = await listPlatformRecordsSummary();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.backupsHeading")}
      </Text>
      <Stack gap="sm">
        {summary.backups.map((backup) => {
          const sizeLabel = formatByteSize(backup.sizeBytes);
          return (
            <Surface key={backup.id}>
              <Stack align="between" direction="row" gap="sm">
                <Text as="h2" variant="subheading">
                  {backup.storageKey}
                </Text>
                <Badge tone="accent">{sizeLabel}</Badge>
              </Stack>
            </Surface>
          );
        })}
      </Stack>
    </Stack>
  );
}
