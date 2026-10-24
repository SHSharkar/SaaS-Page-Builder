import { listPlatformRecordsSummary } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminShortLinksPage() {
  await requirePlatformPageCapability("platform.console.view");
  const summary = await listPlatformRecordsSummary();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.shortLinksHeading")}
      </Text>
      <Stack gap="sm">
        {summary.shortLinks.map((link) => (
          <Surface key={link.id}>
            <Stack align="between" direction="row" gap="sm">
              <Text as="h2" variant="subheading">
                {link.targetPath}
              </Text>
              <Badge tone="accent">{link.kind}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
