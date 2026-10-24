import { getTranslations } from "@/app/server/text";
import { AppLink, Stack, Surface, Text } from "@/components/ui";
import { PUBLIC_PATHS } from "@/lib/paths";

export default function RootNotFound() {
  const t = getTranslations();

  return (
    <Surface className="mx-auto my-16 max-w-lg">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("feedback.notFoundTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("feedback.notFoundDescription")}
        </Text>
        <AppLink href={PUBLIC_PATHS.home} variant="button">
          {t("feedback.returnHome")}
        </AppLink>
      </Stack>
    </Surface>
  );
}
