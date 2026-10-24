import Link from "next/link";
import { can, requireActor } from "@/lib/auth/session";
import { loadOverview } from "@/lib/overview";
import { PageHeader, Panel, Stat, StatusBadge, relativeTime } from "@/components/admin/ui";
import { adminButtonVariants } from "@/lib/theme-classes";

export default async function AdminOverviewPage() {
  const actor = await requireActor();
  const overview = await loadOverview();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Workspace overview"
        title={`Welcome back, ${actor.user.name.split(" ")[0]}`}
        description="Live summary of sites, published pages, custom domains, and recent editorial activity."
        actions={
          can(actor, "site.create") ? (
            <Link href="/admin/sites/new" className={adminButtonVariants({ tone: "primary" })}>
              + New site
            </Link>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Active sites"
          value={overview.activeSiteCount}
          hint={`${overview.siteCount} total`}
          href={can(actor, "site.view") ? "/admin/sites" : undefined}
        />
        <Stat
          label="Published pages"
          value={overview.publishedCount}
          hint={`${overview.pageCount} total drafts & live`}
        />
        <Stat
          label="Verified domains"
          value={overview.verifiedDomains}
          hint={
            overview.pendingDomains > 0
              ? `${overview.pendingDomains} awaiting DNS check`
              : "All active hostnames verified"
          }
        />
        <Stat
          label="Reusable templates"
          value={overview.templateCount}
          hint={`${overview.mediaCount} stored media files`}
          href={can(actor, "template.view") ? "/admin/templates" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Panel
            title="Sites"
            description="Every brand runs its own pages, global chrome, media library, and domains."
            actions={
              can(actor, "site.view") ? (
                <Link
                  href="/admin/sites"
                  className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                >
                  All sites
                </Link>
              ) : null
            }
          >
            <div className="divide-y divide-slate-200">
              {overview.sites.map((entry) => (
                <div
                  key={entry.site.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/sites/${entry.site.id}`}
                        className="text-sm font-semibold text-slate-950 hover:underline"
                      >
                        {entry.site.name}
                      </Link>
                      <StatusBadge status={entry.site.status} />
                    </div>
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                      {entry.primaryDomain ?? entry.site.slug}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>
                      <strong className="text-slate-900">{entry.publishedCount}</strong> live /{" "}
                      {entry.pageCount} pages
                    </p>
                    <Link
                      href={`/admin/sites/${entry.site.id}/pages`}
                      className="text-[11px] font-medium text-slate-700 underline"
                    >
                      Manage pages
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-5">
          <Panel
            title="Recent activity"
            description="Latest recorded administrative and publishing events."
            actions={
              can(actor, "audit.view") ? (
                <Link
                  href="/admin/audit"
                  className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                >
                  Full log
                </Link>
              ) : null
            }
          >
            {overview.recentAudit.length === 0 ? (
              <p className="text-xs text-slate-500">No events recorded yet.</p>
            ) : (
              <ol className="divide-y divide-slate-200 text-xs">
                {overview.recentAudit.map((row) => (
                  <li key={row.id} className="py-2.5 first:pt-0 last:pb-0">
                    <p className="font-medium text-slate-900">{row.summary}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {row.actorEmail ?? "system"} | {relativeTime(row.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
