import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listSiteDomains } from "@/app/server/domains";
import { getTranslations } from "@/app/server/text";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function WorkspaceDomainsPage() {
  const actor = await requireAccountPageCapability("domains.view");
  const domains = await listSiteDomains(actor.account.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {t("domains.heading")}
      </Text>
      <Stack gap="sm">
        {domains.map((dom) => (
          <Surface key={dom.id}>
            <Stack align="between" direction="row" gap="sm">
              <Text as="h2" variant="subheading">
                {dom.hostname}
              </Text>
              <Badge tone="accent">{dom.status}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
