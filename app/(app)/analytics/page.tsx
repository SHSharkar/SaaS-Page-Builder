import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { getWorkspaceOverview } from "@/app/server/overview";
import { getTranslations } from "@/app/server/text";
import { Stack, Surface, Text } from "@/components/ui";

export default async function AnalyticsPage() {
  const actor = await requireAccountPageCapability("analytics.view");
  const overview = await getWorkspaceOverview(actor.account.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("analytics.heading")}
      </Text>
      <div className="grid gap-4 md:grid-cols-3">
        <Surface>
          <Stack gap="sm">
            <Text tone="secondary" variant="caption">
              {t("dashboard.metricSites")}
            </Text>
            <Text as="h2" variant="heading">
              {String(overview.activeSites)}
            </Text>
          </Stack>
        </Surface>
        <Surface>
          <Stack gap="sm">
            <Text tone="secondary" variant="caption">
              {t("dashboard.metricPublishedPages")}
            </Text>
            <Text as="h2" variant="heading">
              {String(overview.publishedPages)}
            </Text>
          </Stack>
        </Surface>
        <Surface>
          <Stack gap="sm">
            <Text tone="secondary" variant="caption">
              {t("dashboard.metricPlacements")}
            </Text>
            <Text as="h2" variant="heading">
              {String(overview.trackedPlacements)}
            </Text>
          </Stack>
        </Surface>
      </div>
    </Stack>
  );
}
