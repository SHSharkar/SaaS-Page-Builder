import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite, listSiteDomains, platformHost } from "@/lib/sites";
import { requireActor } from "@/lib/auth/session";
import { StatusBadge } from "@/components/admin/ui";
import { SiteTabs } from "@/components/admin/site-tabs";

export const dynamic = "force-dynamic";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireActor();
  const site = await getSite(siteId);
  if (!site) notFound();
  const domains = await listSiteDomains(siteId);
  const primary = domains.find((domain) => domain.isPrimary) ?? domains[0];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-500">Site</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">{site.name}</h1>
            <StatusBadge status={site.status} />
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-400">
            {platformHost(site.slug)}
            {primary && primary.kind === "custom" ? ` · ${primary.hostname}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/preview/${site.id}`}
            target="_blank"
            rel="noreferrer"
            className="btn-admin btn-admin-secondary !py-1.5 !text-xs"
          >
            Preview ↗
          </a>
          <Link href={`/edit/${site.id}/globals/navigation`} className="btn-admin btn-admin-secondary !py-1.5 !text-xs">
            Edit navigation
          </Link>
          <Link href={`/admin/sites/${site.id}/pages/new`} className="btn-admin btn-admin-primary !py-1.5 !text-xs">
            New page
          </Link>
        </div>
      </div>
      <SiteTabs siteId={site.id} />
      {children}
    </div>
  );
}
