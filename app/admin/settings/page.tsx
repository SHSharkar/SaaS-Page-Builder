import { listPlatformRecordsSummary } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminSettingsPage() {
  await requirePlatformPageCapability("platform.console.view");
  const summary = await listPlatformRecordsSummary();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.settingsHeading")}
      </Text>
      <Stack gap="sm">
        {summary.settings.map((setting) => (
          <Surface key={setting.key}>
            <Stack align="between" direction="row" gap="sm">
              <Stack gap="sm">
                <Text as="h2" variant="subheading">
                  {setting.key}
                </Text>
                <Text tone="secondary" variant="caption">
                  {setting.description}
                </Text>
              </Stack>
              {setting.isSecret ? (
                <Badge tone="accent">{setting.key}</Badge>
              ) : null}
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
