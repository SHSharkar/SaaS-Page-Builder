import { exportAccountSnapshot } from "@/app/server/accounts";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function ExportDataPage() {
  const actor = await requireAccountPageCapability("export.request");
  const snapshot = await exportAccountSnapshot(actor.account.id);
  const t = getTranslations();
  const summaryLabel = `${snapshot.sites.length} ${t("nav.sites")} / ${snapshot.pages.length} ${t("pages.heading")}`;

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("privacy.exportHeading")}
      </Text>
      <Surface>
        <Stack gap="md">
          <Badge tone="accent">{snapshot.exportedAt}</Badge>
          <Text variant="body">{summaryLabel}</Text>
        </Stack>
      </Surface>
    </Stack>
  );
}
