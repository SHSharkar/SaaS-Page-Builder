import { getTranslations } from "@/app/server/text";
import { AppLink, Stack, Surface, Text } from "@/components/ui";
import { PUBLIC_PATHS } from "@/lib/paths";

export default function ResetPasswordPage() {
  const t = getTranslations();

  return (
    <Surface className="mx-auto max-w-md">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("auth.resetPasswordTitle")}
        </Text>
        <AppLink href={PUBLIC_PATHS.signIn} variant="button">
          {t("nav.signIn")}
        </AppLink>
      </Stack>
    </Surface>
  );
}
