import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function SettingsPage() {
  const actor = await requireAccountPageCapability("workspace.view");
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("settings.heading")}
      </Text>
      <Surface>
        <Stack gap="sm">
          <Text as="h2" variant="subheading">
            {actor.account.name}
          </Text>
          <Stack direction="row" gap="sm">
            <Badge tone="accent">{actor.account.planKey}</Badge>
            <Badge>{actor.account.defaultLocale}</Badge>
          </Stack>
        </Stack>
      </Surface>
    </Stack>
  );
}
