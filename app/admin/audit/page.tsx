import { listPlatformAuditEntries } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminAuditPage() {
  await requirePlatformPageCapability("platform.audit.view");
  const rows = await listPlatformAuditEntries();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.auditHeading")}
      </Text>
      <Stack gap="sm">
        {rows.map((entry) => (
          <Surface key={entry.id}>
            <Stack align="between" direction="row" gap="sm">
              <Stack gap="sm">
                <Text as="h2" variant="subheading">
                  {entry.summary}
                </Text>
                <Text tone="secondary" variant="caption">
                  {entry.targetId}
                </Text>
              </Stack>
              <Badge tone="accent">{entry.action}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
