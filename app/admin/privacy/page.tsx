import { listPlatformErasureLogs } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { AdminRevealContactFormClient } from "@/components/app-shell/admin-forms";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminPrivacyPage() {
  await requirePlatformPageCapability("platform.privacy.reveal");
  const logs = await listPlatformErasureLogs();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.privacyHeading")}
      </Text>
      <AdminRevealContactFormClient />
      <Stack gap="sm">
        {logs.map((entry) => (
          <Surface key={entry.id}>
            <Stack align="between" direction="row" gap="sm">
              <Text as="h2" variant="subheading">
                {entry.subjectLookupHash.slice(0, 16)}
              </Text>
              <Badge tone="accent">{entry.erasedAt.toISOString()}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
