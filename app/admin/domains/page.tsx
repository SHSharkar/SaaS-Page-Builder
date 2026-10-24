import { listPlatformDomains } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminDomainsPage() {
  await requirePlatformPageCapability("platform.console.view");
  const rows = await listPlatformDomains();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.domainsHeading")}
      </Text>
      <Stack gap="sm">
        {rows.map((dom) => (
          <Surface key={dom.id}>
            <Stack align="between" direction="row" gap="sm">
              <Text as="h2" variant="subheading">
                {dom.hostname}
              </Text>
              <Badge tone="accent">{dom.status}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
