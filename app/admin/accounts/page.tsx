import { listPlatformAccounts } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { AdminAccountStatusButton } from "@/components/app-shell/admin-forms";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function AdminAccountsPage() {
  const ctx = await requirePlatformPageCapability("platform.console.view");
  const rows = await listPlatformAccounts();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.accountsHeading")}
      </Text>
      <Stack gap="sm">
        {rows.map((acct) => (
          <Surface key={acct.id}>
            <Stack align="between" direction="row" gap="sm">
              <Stack gap="sm">
                <Text as="h2" variant="subheading">
                  {acct.name}
                </Text>
                <Stack direction="row" gap="sm">
                  <Badge>{acct.slug}</Badge>
                  <Badge tone="accent">{acct.status}</Badge>
                </Stack>
              </Stack>
              {ctx.platformRole === "superadmin" ? (
                <AdminAccountStatusButton
                  accountId={acct.id}
                  currentStatus={acct.status}
                />
              ) : null}
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
