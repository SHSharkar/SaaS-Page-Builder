import { listPlatformRecordsSummary } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminTemplatesPage() {
  await requirePlatformPageCapability("platform.console.view");
  const summary = await listPlatformRecordsSummary();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.templatesHeading")}
      </Text>
      <Stack gap="sm">
        {summary.templates.map((tpl) => (
          <Surface key={tpl.id}>
            <Stack align="between" direction="row" gap="sm">
              <Text as="h2" variant="subheading">
                {tpl.name}
              </Text>
              <Badge tone="accent">{tpl.category}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
