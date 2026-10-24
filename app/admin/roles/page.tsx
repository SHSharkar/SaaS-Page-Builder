import { listPlatformRoles } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminRolesPage() {
  await requirePlatformPageCapability("platform.console.view");
  const rows = await listPlatformRoles();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.rolesHeading")}
      </Text>
      <Stack gap="sm">
        {rows.map((role) => (
          <Surface key={role.id}>
            <Stack align="between" direction="row" gap="sm">
              <Stack gap="sm">
                <Text as="h2" variant="subheading">
                  {role.name}
                </Text>
                <Text tone="secondary" variant="caption">
                  {role.description}
                </Text>
              </Stack>
              <Badge tone="accent">{role.key}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
