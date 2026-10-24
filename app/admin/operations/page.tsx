import { listWorkerHeartbeats } from "@/app/server/admin";
import { requirePlatformPageCapability } from "@/app/server/auth/guards";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";
import { JOB_KINDS } from "@/lib/enums";

export default async function AdminOperationsPage() {
  await requirePlatformPageCapability("platform.console.view");
  const workers = await listWorkerHeartbeats();
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("admin.operationsHeading")}
      </Text>
      <Surface>
        <Stack gap="sm">
          {JOB_KINDS.map((kind) => (
            <Badge key={kind} tone="accent">
              {kind}
            </Badge>
          ))}
        </Stack>
      </Surface>
      <Stack gap="sm">
        {workers.map((worker) => (
          <Surface key={worker.workerId}>
            <Stack align="between" direction="row" gap="sm">
              <Text as="h2" variant="subheading">
                {worker.workerId}
              </Text>
              <Badge>{worker.updatedAt.toISOString()}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
