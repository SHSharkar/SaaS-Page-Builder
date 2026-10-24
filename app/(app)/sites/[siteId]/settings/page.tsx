import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getAccountSite } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function SiteSettingsPage({
  params,
}: {
  readonly params: Promise<{ siteId: string }>;
}) {
  const actor = await requireAccountPageCapability("sites.manage");
  const { siteId } = await params;
  const site = await getAccountSite(actor.account.id, siteId);
  if (!site) {
    notFound();
  }
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {`${site.name} - ${t("settings.heading")}`}
      </Text>
      <Surface>
        <Stack gap="sm">
          <Text as="h2" variant="subheading">
            {site.name}
          </Text>
          <Badge>{site.slug}</Badge>
          {site.scanCode ? <Badge tone="accent">{site.scanCode}</Badge> : null}
        </Stack>
      </Surface>
    </Stack>
  );
}
