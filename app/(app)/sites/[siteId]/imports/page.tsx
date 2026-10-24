import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listSiteImports } from "@/app/server/imports";
import { getAccountSite } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function SiteImportsPage({
  params,
}: {
  readonly params: Promise<{ siteId: string }>;
}) {
  const actor = await requireAccountPageCapability("imports.manage");
  const { siteId } = await params;
  const site = await getAccountSite(actor.account.id, siteId);
  if (!site) {
    notFound();
  }
  const jobs = await listSiteImports(actor.account.id, site.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {`${site.name} - ${t("imports.heading")}`}
      </Text>
      <Stack gap="sm">
        {jobs.map((job) => (
          <Surface key={job.id}>
            <Stack align="between" direction="row" gap="sm">
              <Text as="h2" variant="subheading">
                {job.sourceFilename}
              </Text>
              <Badge tone="accent">{job.status}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
