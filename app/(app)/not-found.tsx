import { getTranslations } from "@/app/server/text";
import { AppLink, Stack, Surface, Text } from "@/components/ui";
import { APP_PATHS } from "@/lib/paths";

export default function WorkspaceNotFound() {
  const t = getTranslations();

  return (
    <Surface className="mx-auto max-w-lg">
      <Stack gap="md">
        <Text as="h1" variant="heading">
          {t("feedback.notFoundTitle")}
        </Text>
        <Text tone="secondary" variant="body">
          {t("feedback.notFoundDescription")}
        </Text>
        <AppLink href={APP_PATHS.dashboard} variant="button">
          {t("nav.dashboard")}
        </AppLink>
      </Stack>
    </Surface>
  );
}
