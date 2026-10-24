import { listPlatformComponents } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminComponentsPage() {
  await requirePlatformPageCapability("platform.console.view");
  const defs = await listPlatformComponents();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.componentsHeading")}
      </Text>
      <div className="grid gap-4 md:grid-cols-3">
        {defs.map((def) => (
          <Surface key={def.id}>
            <Stack gap="sm">
              <Badge tone="accent">{def.groupKey}</Badge>
              <Text as="h2" variant="subheading">
                {def.name}
              </Text>
              <Text tone="secondary" variant="caption">
                {def.alias}
              </Text>
            </Stack>
          </Surface>
        ))}
      </div>
    </Stack>
  );
}
