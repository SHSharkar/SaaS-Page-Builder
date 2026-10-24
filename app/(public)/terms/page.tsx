import { getTranslations } from "@/app/server/text";
import { Stack, Surface, Text } from "@/components/ui";

export default function TermsPage() {
  const t = getTranslations();

  return (
    <Surface>
      <Stack gap="md">
        <Text as="h1" variant="display">
          {t("marketing.termsTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("marketing.featureRlsBody")}
        </Text>
      </Stack>
    </Surface>
  );
}
