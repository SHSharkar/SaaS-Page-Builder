import { listPlatformSites } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminSitesPage() {
  await requirePlatformPageCapability("platform.console.view");
  const rows = await listPlatformSites();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.sitesHeading")}
      </Text>
      <Stack gap="sm">
        {rows.map((site) => (
          <Surface key={site.id}>
            <Stack align="between" direction="row" gap="sm">
              <Text as="h2" variant="subheading">
                {site.name}
              </Text>
              <Stack direction="row" gap="sm">
                <Badge>{site.slug}</Badge>
                <Badge tone="accent">{site.status}</Badge>
              </Stack>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
