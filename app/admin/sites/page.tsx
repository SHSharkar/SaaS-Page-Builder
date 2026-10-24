import Link from "next/link";
import { listSites, platformHost } from "@/lib/sites";
import { requireView } from "@/lib/auth/session";
import { siteCounts } from "@/lib/sites";
import { PageHeader, Panel, StatusBadge, EmptyState, relativeTime } from "@/components/admin/ui";
import { listDeletedSites } from "@/lib/sites";
import { DeletedSites } from "@/components/admin/deleted-sites";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  await requireView("site.view");
  const sites = await listSites();
  const counts = await Promise.all(sites.map((row) => siteCounts(row.site.id)));
  const deleted = await listDeletedSites();

  return (
    <div>
      <PageHeader
        eyebrow="Workspace"
        title="Sites"
        description="Every site is one brand with its own theme, navigation, footer, pages and hostnames. Publish is always explicit — nothing goes live by accident."
        actions={
          <Link href="/admin/sites/new" className="btn-admin btn-admin-primary">
            New site
          </Link>
        }
        breadcrumb={[{ label: "Overview", href: "/admin" }, { label: "Sites" }]}
      />
      {sites.length === 0 ? (
        <EmptyState
          title="No sites yet"
          description="Create the first site to get a theme, global navigation, footer and a homepage."
          action={
            <Link href="/admin/sites/new" className="btn-admin btn-admin-accent">
              Create a site
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {sites.map((row, index) => {
            const count = counts[index];
            return (
              <Panel key={row.site.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/sites/${row.site.id}`}
                        className="text-base font-semibold tracking-tight text-ink-900 hover:underline"
                      >
                        {row.site.name}
                      </Link>
                      <StatusBadge status={row.site.status} />
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-black/10"
                        style={{ background: row.site.theme.accent }}
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">
                      {platformHost(row.site.slug)} · /{row.site.slug}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      {count.pages} pages · {count.published} live · {count.drafts} drafts · {count.media} images ·{" "}
                      {count.domains} hostnames
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/sites/${row.site.id}/pages`}
                      className="btn-admin btn-admin-secondary !py-1.5 !text-xs"
                    >
                      Pages
                    </Link>
                    <Link
                      href={`/admin/sites/${row.site.id}/pages/new`}
                      className="btn-admin btn-admin-secondary !py-1.5 !text-xs"
                    >
                      New page
                    </Link>
                    <Link
                      href={`/admin/sites/${row.site.id}/settings`}
                      className="btn-admin btn-admin-primary !py-1.5 !text-xs"
                    >
                      Manage
                    </Link>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-paper/60 px-5 py-2 text-[11px] text-slate-500">
                  <span>Updated {relativeTime(row.site.updatedAt)}</span>
                  <span>{count.versions} snapshots kept</span>
                  <span>{count.imports} imports</span>
                  <a
                    href={`/preview/${row.site.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto font-medium text-slate-600 underline hover:text-ink-900"
                  >
                    Staff preview ↗
                  </a>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <DeletedSites
        sites={deleted.map((row) => ({
          id: row.site.id,
          name: row.site.name,
          slug: row.site.slug,
          deletedAt: row.site.deletedAt ? row.site.deletedAt.toISOString() : null,
          restorableUntil: row.restorableUntil ? row.restorableUntil.toISOString() : null,
        }))}
      />
    </div>
  );
}
