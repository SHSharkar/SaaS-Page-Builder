import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { listPagesWithCounts } from "@/lib/pages";
import { listSiteDomains } from "@/lib/domains";
import { listSiteMedia } from "@/lib/media";
import { listAudit } from "@/lib/audit";
import { Panel, Stat, StatusBadge, relativeTime } from "@/components/admin/ui";
import { adminButtonVariants } from "@/lib/theme-classes";

export default async function SiteOverviewPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const actor = await requireView("site.view", `/admin/sites/${siteId}`);
  const site = await getSite(siteId);
  if (!site) notFound();

  const [pages, domains, media, recentAudit] = await Promise.all([
    listPagesWithCounts(siteId),
    listSiteDomains(siteId),
    listSiteMedia(siteId),
    listAudit({ siteId, limit: 8 }),
  ]);

  const publishedPages = pages.filter(({ page }) => page.status === "published");
  const activeDomains = domains.filter((domain) => domain.status === "active");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Pages"
          value={pages.length}
          hint={`${publishedPages.length} live`}
          href={`/admin/sites/${siteId}/pages`}
        />
        <Stat
          label="Active domains"
          value={activeDomains.length}
          hint={`${domains.length} configured`}
          href={`/admin/sites/${siteId}/domains`}
        />
        <Stat
          label="Media files"
          value={media.length}
          hint="Site-scoped assets"
          href={`/admin/sites/${siteId}/media`}
        />
        <Stat
          label="Theme palette"
          value={site.theme.palette ?? "obsidian-gold"}
          hint={`${site.theme.fontPair ?? site.theme.headingFont} / ${site.theme.radius}`}
          href={`/admin/sites/${siteId}/settings`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <Panel
            title="Pages on this site"
            actions={
              can(actor, "page.create") ? (
                <Link
                  href={`/admin/sites/${siteId}/pages/new`}
                  className={adminButtonVariants({ tone: "primary", size: "sm" })}
                >
                  + New page
                </Link>
              ) : null
            }
          >
            {pages.length === 0 ? (
              <p className="text-xs text-slate-500">No pages yet.</p>
            ) : (
              <div className="divide-y divide-slate-200">
                {pages.slice(0, 8).map(({ page, versionCount }) => (
                  <div
                    key={page.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs first:pt-0 last:pb-0"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/sites/${siteId}/pages/${page.id}`}
                          className="font-semibold text-slate-950 hover:underline"
                        >
                          {page.title}
                        </Link>
                        <StatusBadge status={page.status} />
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {page.slug ? `/${page.slug}` : "/"} | {versionCount} version
                        {versionCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <Link
                      href={`/edit/${siteId}/${page.id}`}
                      className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                    >
                      Open editor
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-5">
          <Panel title="Recent site activity">
            {recentAudit.length === 0 ? (
              <p className="text-xs text-slate-500">No activity recorded for this site yet.</p>
            ) : (
              <ol className="divide-y divide-slate-200 text-xs">
                {recentAudit.map((entry) => (
                  <li key={entry.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="font-medium text-slate-900">{entry.summary}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {entry.actorEmail ?? "system"} | {relativeTime(entry.createdAt)}
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
