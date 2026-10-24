import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getWorkspaceOverview } from "@/app/server/overview";
import { listAccountSites } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { AppLink, Badge, Stack, Surface, Text } from "@/components/ui";
import { APP_PATHS, PUBLIC_PATHS } from "@/lib/paths";

export default async function DashboardPage() {
  const actor = await requireAccountPageCapability("workspace.view");
  const t = getTranslations();
  const overview = await getWorkspaceOverview(actor.account.id);
  const sites = await listAccountSites(actor.account.id);

  const metrics = [
    { label: t("dashboard.metricSites"), value: String(overview.activeSites) },
    {
      label: t("dashboard.metricPublishedPages"),
      value: String(overview.publishedPages),
    },
    {
      label: t("dashboard.metricDomains"),
      value: String(overview.verifiedDomains),
    },
    {
      label: t("dashboard.metricPlacements"),
      value: String(overview.trackedPlacements),
    },
  ];

  return (
    <Stack gap="lg">
      <Stack align="between" direction="row" gap="md">
        <Stack gap="sm">
          <Text as="h1" variant="display">
            {t("dashboard.heading")}
          </Text>
          <Text tone="secondary" variant="body">
            {t("dashboard.subheading")}
          </Text>
        </Stack>
        <AppLink href={APP_PATHS.newSite} variant="button">
          {t("sites.createSite")}
        </AppLink>
      </Stack>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map((metric) => (
          <Surface key={metric.label}>
            <Stack gap="sm">
              <Text tone="secondary" variant="caption">
                {metric.label}
              </Text>
              <Text as="h2" variant="heading">
                {metric.value}
              </Text>
            </Stack>
          </Surface>
        ))}
      </div>

      <Surface>
        <Stack gap="md">
          <Text as="h2" variant="subheading">
            {t("sites.heading")}
          </Text>
          {sites.length === 0 ? (
            <Text tone="secondary" variant="body">
              {t("sites.emptyDescription")}
            </Text>
          ) : (
            <Stack gap="sm">
              {sites.map((site) => (
                <Surface key={site.id} tone="muted">
                  <Stack align="between" direction="row" gap="sm">
                    <Stack gap="sm">
                      <Text as="h3" variant="subheading">
                        {site.name}
                      </Text>
                      <Badge>{site.slug}</Badge>
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
            </Stack>
          )}
        </Stack>
      </Surface>
    </Stack>
  );
}
