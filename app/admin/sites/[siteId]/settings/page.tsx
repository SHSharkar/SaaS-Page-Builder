import { notFound } from "next/navigation";
import { can, hasRecentStepUp, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { Panel } from "@/components/admin/ui";
import { StepUpNotice } from "@/components/admin/step-up-notice";
import { SiteSettingsForm } from "@/components/admin/site-settings-form";

export default async function SiteSettingsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const actor = await requireView("site.view", `/admin/sites/${siteId}/settings`);
  const site = await getSite(siteId);
  if (!site) notFound();

  const canEdit = can(actor, "site.update");
  const canSuspend = can(actor, "site.suspend");
  const canDelete = can(actor, "site.delete");
  const needsStepUp = (canSuspend || canDelete) && !(await hasRecentStepUp(actor));

  return (
    <div className="space-y-6">
      {needsStepUp ? <StepUpNotice /> : null}

      <Panel
        title="Brand theme & site lifecycle"
        description="Theme tokens apply across every block on this site without writing raw CSS."
      >
        <SiteSettingsForm
          siteId={site.id}
          initialName={site.name}
          initialTheme={site.theme}
          status={site.status}
          canEdit={canEdit}
          canSuspend={canSuspend}
          canDelete={canDelete}
        />
      </Panel>
    </div>
  );
}
