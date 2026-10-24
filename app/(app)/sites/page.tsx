import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listAccountSites } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { AppLink, Badge, Stack, Surface, Text } from "@/components/ui";
import { APP_PATHS, PUBLIC_PATHS } from "@/lib/paths";

export default async function SitesPage() {
  const actor = await requireAccountPageCapability("sites.view");
  const t = getTranslations();
  const sites = await listAccountSites(actor.account.id);

  return (
    <Stack gap="lg">
      <Stack align="between" direction="row" gap="md">
        <Text as="h1" variant="display">
          {t("sites.heading")}
        </Text>
        <AppLink href={APP_PATHS.newSite} variant="button">
          {t("sites.createSite")}
        </AppLink>
      </Stack>

      {sites.length === 0 ? (
        <Surface>
          <Stack gap="sm">
            <Text as="h2" variant="subheading">
              {t("sites.emptyTitle")}
            </Text>
            <Text tone="secondary" variant="body">
              {t("sites.emptyDescription")}
            </Text>
          </Stack>
        </Surface>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sites.map((site) => (
            <Surface key={site.id}>
              <Stack gap="md">
                <Stack align="between" direction="row" gap="sm">
                  <Text as="h2" variant="subheading">
                    {site.name}
                  </Text>
                  <Badge tone="accent">{site.status}</Badge>
                </Stack>
                <Stack direction="row" gap="sm">
                  <AppLink
                    href={APP_PATHS.siteDetail(site.id)}
                    variant="button"
                  >
                    {t("sites.openStudio")}
                  </AppLink>
                  <AppLink
                    href={PUBLIC_PATHS.publishedSite(site.slug)}
                    variant="nav"
                  >
                    {t("sites.viewLive")}
                  </AppLink>
                </Stack>
              </Stack>
            </Surface>
          ))}
        </div>
      )}
    </Stack>
  );
}
