import { getPlatformOverviewStats } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Stack, Surface, Text } from "@/components/ui";

export default async function AdminOverviewPage() {
  await requirePlatformPageCapability("platform.console.view");
  const stats = await getPlatformOverviewStats();
  const t = getTranslations();

  const cards = [
    { label: t("admin.accountsHeading"), value: String(stats.accounts) },
    { label: t("admin.sitesHeading"), value: String(stats.sites) },
    { label: t("admin.domainsHeading"), value: String(stats.domains) },
    { label: t("admin.usersHeading"), value: String(stats.users) },
  ];

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.overviewHeading")}
      </Text>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <Surface key={card.label}>
            <Stack gap="sm">
              <Text tone="secondary" variant="caption">
                {card.label}
              </Text>
              <Text as="h2" variant="heading">
                {card.value}
              </Text>
            </Stack>
          </Surface>
        ))}
      </div>
    </Stack>
  );
}
