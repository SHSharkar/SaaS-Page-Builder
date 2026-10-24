import { listPlatformUsers } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminUsersPage() {
  await requirePlatformPageCapability("platform.console.view");
  const rows = await listPlatformUsers();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.usersHeading")}
      </Text>
      <Stack gap="sm">
        {rows.map((user) => (
          <Surface key={user.id}>
            <Stack align="between" direction="row" gap="sm">
              <Stack gap="sm">
                <Text as="h2" variant="subheading">
                  {user.name}
                </Text>
                <Text tone="secondary" variant="caption">
                  {user.email}
                </Text>
              </Stack>
              <Badge tone="accent">{user.platformRole}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
