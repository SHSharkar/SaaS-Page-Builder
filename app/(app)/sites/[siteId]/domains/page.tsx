import { notFound } from "next/navigation";
import { requireAccountPageCapability } from "@/app/server/auth/guards";
import { listSiteDomains } from "@/app/server/domains";
import { getAccountSite } from "@/app/server/sites";
import { getTranslations } from "@/app/server/text";
import { AddDomainFormClient } from "@/components/app-shell/workspace-forms";
import { Badge, Stack, Surface, Text } from "@/components/ui";

export default async function SiteDomainsPage({
  params,
}: {
  readonly params: Promise<{ siteId: string }>;
}) {
  const actor = await requireAccountPageCapability("domains.view");
  const { siteId } = await params;
  const site = await getAccountSite(actor.account.id, siteId);
  if (!site) {
    notFound();
  }
  const domains = await listSiteDomains(actor.account.id, site.id);
  const t = getTranslations();

  return (
    <Stack gap="lg">
      <Text as="h1" variant="display">
        {`${site.name} - ${t("domains.heading")}`}
      </Text>
      <AddDomainFormClient siteId={site.id} />
      <Stack gap="sm">
        {domains.map((dom) => (
          <Surface key={dom.id}>
            <Stack align="between" direction="row" gap="sm">
              <Stack gap="sm">
                <Text as="h2" variant="subheading">
                  {dom.hostname}
                </Text>
                {dom.verificationToken ? (
                  <Text tone="secondary" variant="caption">
                    {`${t("domains.txtRecordLabel")}: ${dom.verificationToken}`}
                  </Text>
                ) : null}
              </Stack>
              <Badge tone="accent">{dom.status}</Badge>
            </Stack>
          </Surface>
        ))}
      </Stack>
    </Stack>
  );
}
