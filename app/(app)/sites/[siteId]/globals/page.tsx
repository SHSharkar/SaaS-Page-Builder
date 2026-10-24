import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listSiteGlobals } from "@/app/server/globals";
import { getAccountSite } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function SiteGlobalsPage({
  params,
}: {
  readonly params: Promise<{ siteId: string }>;
}) {
  const actor = await requireAccountPageCapability("sites.view");
  const { siteId } = await params;
  const site = await getAccountSite(actor.account.id, siteId);
  if (!site) {
    notFound();
  }
  const contents = await listSiteGlobals(actor.account.id, site.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {`${site.name} - ${t("sites.heading")}`}
      </Text>
      <div className="grid gap-4 md:grid-cols-3">
        {contents.map((item) => (
          <Surface key={item.id}>
            <Stack gap="sm">
              <Badge tone="accent">{item.kind}</Badge>
              <Text tone="secondary" variant="caption">
                {item.publishedAt ? t("common.confirm") : t("common.loading")}
              </Text>
            </Stack>
          </Surface>
        ))}
      </div>
    </Stack>
  );
}
