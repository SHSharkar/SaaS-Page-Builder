import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { primaryHostname } from "@/lib/domains";
import { StatusBadge } from "@/components/admin/ui";
import { SiteTabs } from "@/components/admin/site-tabs";

export default async function SiteWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireView("site.view", `/admin/sites/${siteId}`);
  const site = await getSite(siteId);
  if (!site) notFound();
  const primary = await primaryHostname(site.id);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-lg font-semibold text-slate-950">{site.name}</span>
          <StatusBadge status={site.status} />
          <span className="font-mono text-xs text-slate-400">{primary ?? site.slug}</span>
        </div>
      </div>
      <SiteTabs siteId={site.id} />
      {children}
    </div>
  );
}
