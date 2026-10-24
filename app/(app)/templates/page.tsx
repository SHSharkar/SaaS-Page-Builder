import { requireAccountPageCapability } from "@/app/server/auth/guards";
import {
  listAccountTemplates,
  listPlatformTemplates,
} from "@/app/server/templates";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function TemplatesPage() {
  const actor = await requireAccountPageCapability("templates.view");
  const platform = await listPlatformTemplates();
  const account = await listAccountTemplates(actor.account.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("templates.heading")}
      </Text>
      <Stack gap="md">
        <Text as="h2" variant="subheading">
          {t("templates.platformGallery")}
        </Text>
        <div className="grid gap-4 md:grid-cols-3">
          {platform.map((tpl) => (
            <Surface key={tpl.id}>
              <Stack gap="sm">
                <Badge tone="accent">{tpl.category}</Badge>
                <Text as="h3" variant="subheading">
                  {tpl.name}
                </Text>
                <Text tone="secondary" variant="caption">
                  {tpl.description}
                </Text>
              </Stack>
            </Surface>
          ))}
        </div>
      </Stack>
      <Stack gap="md">
        <Text as="h2" variant="subheading">
          {t("templates.workspaceGallery")}
        </Text>
        <div className="grid gap-4 md:grid-cols-3">
          {account.map((tpl) => (
            <Surface key={tpl.id}>
              <Stack gap="sm">
                <Badge>{tpl.category}</Badge>
                <Text as="h3" variant="subheading">
                  {tpl.name}
                </Text>
              </Stack>
            </Surface>
          ))}
        </div>
      </Stack>
    </Stack>
  );
}
