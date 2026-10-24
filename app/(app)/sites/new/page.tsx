import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { CreateSiteFormClient } from "@/components/app-shell/workspace-forms";
import { Stack, Text } from "@/components/ui";

export default async function NewSitePage() {
  await requireAccountPageCapability("sites.manage");
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("sites.createSite")}
      </Text>
      <CreateSiteFormClient />
    </Stack>
  );
}
