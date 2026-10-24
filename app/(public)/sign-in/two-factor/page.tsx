import { getTranslations } from "@/app/server/text";
import { AppLink, Stack, Surface, Text } from "@/components/ui";
import { PUBLIC_PATHS } from "@/lib/paths";

export default function TwoFactorPage() {
  const t = getTranslations();

  return (
    <Surface className="mx-auto max-w-md">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("auth.twoFactorTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("auth.twoFactorCodeLabel")}
        </Text>
        <AppLink href={PUBLIC_PATHS.signIn} variant="nav">
          {t("nav.signIn")}
        </AppLink>
      </Stack>
    </Surface>
  );
}
