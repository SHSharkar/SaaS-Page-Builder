import { notFound } from "next/navigation";
import { can, hasRecentStepUp, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { listSiteDomains } from "@/lib/domains";
import { getSetting } from "@/lib/settings";
import { Panel } from "@/components/admin/ui";
import { StepUpNotice } from "@/components/admin/step-up-notice";
import { DomainsManager } from "@/components/admin/domains-manager";

export default async function SiteDomainsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const actor = await requireView("site.view", `/admin/sites/${siteId}/domains`);
  const site = await getSite(siteId);
  if (!site) notFound();

  const [rows, prefix, steppedUp] = await Promise.all([
    listSiteDomains(siteId),
    getSetting("domain.verification_txt_prefix"),
    hasRecentStepUp(actor),
  ]);

  const canManage = can(actor, "domain.manage");
  const canVerify = can(actor, "domain.verify");

  const serialized = rows.map((row) => ({
    id: row.id,
    hostname: row.hostname,
    kind: row.kind,
    status: row.status,
    isPrimary: row.isPrimary,
    verificationToken: row.verificationToken,
    lastError: row.failureReason,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    removedAt: row.removedAt?.toISOString() ?? null,
  }));

  return (
    <div className="space-y-6">
      {canManage && !steppedUp ? <StepUpNotice /> : null}

      <Panel
        title="Domains & TLS verification"
        description="Custom domains serve traffic and pass the Caddy on-demand TLS gate only after DNS TXT verification succeeds."
      >
        <DomainsManager
          siteId={siteId}
          domains={serialized}
          canManage={canManage}
          canVerify={canVerify}
          verificationPrefix={prefix}
        />
      </Panel>
    </div>
  );
}
