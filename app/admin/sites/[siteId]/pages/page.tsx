import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { listPagesWithCounts } from "@/lib/pages";
import { listTrashedPagesForSite } from "@/lib/actions/pages";
import { EmptyState, Panel, StatusBadge, relativeTime } from "@/components/admin/ui";
import { TrashedPagesPanel } from "@/components/admin/pages-trash-panel";
import { adminButtonVariants } from "@/lib/theme-classes";

export default async function SitePagesIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const actor = await requireView("page.view", `/admin/sites/${siteId}/pages`);
  const site = await getSite(siteId);
  if (!site) notFound();

  const canCreate = can(actor, "page.create");
  const canEdit = can(actor, "page.edit");
  const canDelete = can(actor, "page.archive");

  const [pages, trashedRaw] = await Promise.all([
    listPagesWithCounts(siteId),
    canEdit || canDelete ? listTrashedPagesForSite(siteId) : Promise.resolve([]),
  ]);

  const nowMs = Date.now();
  const trashed = trashedRaw.map((entry) => ({
    id: entry.page.id,
    title: entry.page.title,
    slug: entry.page.slug,
    trashedAt: entry.page.deletedAt?.toISOString() ?? null,
    purgeAfter: entry.restorableUntil?.toISOString() ?? null,
    daysLeft: entry.restorableUntil
      ? Math.max(0, Math.ceil((entry.restorableUntil.getTime() - nowMs) / 86_400_000))
      : 0,
  }));

  return (
    <div className="space-y-6">
      <Panel
        title={`Pages (${pages.length})`}
        description="Draft, published, and archived pages belonging to this site."
        actions={
          canCreate ? (
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
          <EmptyState
            title="No pages on this site"
            description="Create a blank page, pick a starter template, or import an existing HTML landing page."
            action={
              canCreate ? (
                <Link
                  href={`/admin/sites/${siteId}/pages/new`}
                  className={adminButtonVariants({ tone: "primary" })}
                >
                  Create first page
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="divide-y divide-slate-200">
            {pages.map(({ page, versionCount }) => (
              <div
                key={page.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5 text-xs first:pt-0 last:pb-0"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/admin/sites/${siteId}/pages/${page.id}`}
                      className="text-sm font-semibold text-slate-950 hover:underline"
                    >
                      {page.title}
                    </Link>
                    <StatusBadge status={page.status} />
                    {page.isHomepage ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                        homepage
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                    {page.slug ? `/${page.slug}` : "/"} | {versionCount} published version
                    {versionCount === 1 ? "" : "s"} | updated {relativeTime(page.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/preview/${siteId}/${page.id}`}
                    target="_blank"
                    className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                  >
                    Preview
                  </Link>
                  <Link
                    href={`/admin/sites/${siteId}/pages/${page.id}`}
                    className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                  >
                    Details
                  </Link>
                  <Link
                    href={`/edit/${siteId}/${page.id}`}
                    className={adminButtonVariants({ tone: "primary", size: "sm" })}
                  >
                    {canEdit ? "Edit" : "Inspect"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {(canEdit || canDelete) && trashed.length > 0 ? (
        <Panel
          title={`Trash (${trashed.length})`}
          description="Trashed pages remain restorable for 30 days before permanent deletion."
        >
          <TrashedPagesPanel
            siteId={siteId}
            pages={trashed}
            canEdit={canEdit}
            canDelete={canDelete}
          />
        </Panel>
      ) : null}
    </div>
  );
}
