import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listSitePages } from "@/app/server/pages";
import { getAccountSite } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { CreatePageFormClient } from "@/components/app-shell/workspace-forms";
import { AppLink, Badge, Stack, Surface, Text } from "@/components/ui";
import { APP_PATHS, PUBLIC_PATHS } from "@/lib/paths";

export default async function SiteDetailPage({
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
  const sitePages = await listSitePages(actor.account.id, site.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Surface>
        <Stack align="between" direction="row" gap="md">
          <Stack gap="sm">
            <Text as="h1" variant="display">
              {site.name}
            </Text>
            <Stack direction="row" gap="sm">
              <Badge tone="accent">{site.slug}</Badge>
              <Badge>{site.status}</Badge>
            </Stack>
          </Stack>
          <Stack direction="row" gap="sm">
            <AppLink href={APP_PATHS.sitePages(site.id)} variant="nav">
              {t("pages.heading")}
            </AppLink>
            <AppLink href={APP_PATHS.siteGlobals(site.id)} variant="nav">
              {t("sites.heading")}
            </AppLink>
            <AppLink href={APP_PATHS.siteDomains(site.id)} variant="nav">
              {t("domains.heading")}
            </AppLink>
            <AppLink
              href={PUBLIC_PATHS.publishedSite(site.slug)}
              variant="button"
            >
              {t("sites.viewLive")}
            </AppLink>
          </Stack>
        </Stack>
      </Surface>

      <div className="grid gap-6 md:grid-cols-2">
        <Surface>
          <Stack gap="md">
            <Text as="h2" variant="subheading">
              {t("pages.heading")}
            </Text>
            {sitePages.map((pg) => (
              <Surface key={pg.id} tone="muted">
                <Stack align="between" direction="row" gap="sm">
                  <Stack gap="sm">
                    <Text as="h3" variant="subheading">
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
        </Surface>

        <CreatePageFormClient siteId={site.id} />
      </div>
    </Stack>
  );
}
