import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listSitePages } from "@/app/server/pages";
import { getAccountSite } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { CreatePageFormClient } from "@/components/app-shell/workspace-forms";
import { AppLink, Badge, Stack, Surface, Text } from "@/components/ui";
import { APP_PATHS } from "@/lib/paths";

export default async function SitePagesListPage({
  params,
}: {
  readonly params: Promise<{ siteId: string }>;
}) {
  const actor = await requireAccountPageCapability("pages.view");
  const { siteId } = await params;
  const site = await getAccountSite(actor.account.id, siteId);
  if (!site) {
    notFound();
  }
  const sitePages = await listSitePages(actor.account.id, site.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {`${site.name} - ${t("pages.heading")}`}
      </Text>
      <CreatePageFormClient siteId={site.id} />
      <Stack gap="sm">
        {sitePages.map((pg) => (
          <Surface key={pg.id}>
            <Stack align="between" direction="row" gap="sm">
              <Stack gap="sm">
                <Text as="h2" variant="subheading">
                  {pg.title}
                </Text>
                <Stack direction="row" gap="sm">
                  <Badge>{pg.slug}</Badge>
                  <Badge tone="accent">{pg.status}</Badge>
                </Stack>
              </Stack>
              <AppLink
                href={APP_PATHS.siteEditor(site.id, pg.id)}
                variant="button"
              >
                {t("sites.openStudio")}
              </AppLink>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
