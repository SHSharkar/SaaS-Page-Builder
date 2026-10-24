import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listSiteImports } from "@/app/server/imports";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function WorkspaceImportsPage() {
  const actor = await requireAccountPageCapability("imports.manage");
  const jobs = await listSiteImports(actor.account.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("imports.heading")}
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
