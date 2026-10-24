import { getTranslations } from "@/app/server/text";
import { AppLink, Stack, Surface, Text } from "@/components/ui";
import { PUBLIC_PATHS } from "@/lib/paths";

export default function PrivacyPolicyPage() {
  const t = getTranslations();

  return (
    <Surface>
      <Stack gap="md">
        <Text as="h1" variant="display">
          {t("marketing.privacyTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("privacy.myDataDescription")}
        </Text>
        <AppLink href={PUBLIC_PATHS.myData} variant="button">
          {t("privacy.myDataTitle")}
        </AppLink>
      </Stack>
    </Surface>
  );
}
