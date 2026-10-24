import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { listPages } from "@/lib/pages";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, Panel, StatusBadge, EmptyState, relativeTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Drafts" },
  { key: "scheduled", label: "Scheduled" },
  { key: "archived", label: "Archived" },
];

export default async function SitePagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { siteId } = await params;
  const { status = "all" } = await searchParams;
  await requireActor();
  const site = await getSite(siteId);
  if (!site) notFound();

  const rows = await listPages(siteId);
  const filtered = rows.filter((row) => {
    if (status === "scheduled") return Boolean(row.page.scheduledPublishAt || row.page.scheduledUnpublishAt);
    if (status === "all") return true;
    return row.page.status === status;
  });

  return (
    <div>
      <PageHeader
        title="Pages"
        description="Each page keeps a draft and an immutable published snapshot. Publishing clears the cache in the same request."
        actions={
          <Link href={`/admin/sites/${siteId}/pages/new`} className="btn-admin btn-admin-primary">
            New page
          </Link>
        }
        breadcrumb={[{ label: site.name, href: `/admin/sites/${siteId}` }, { label: "Pages" }]}
      />

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key}
            href={`/admin/sites/${siteId}/pages${filter.key === "all" ? "" : `?status=${filter.key}`}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              status === filter.key
                ? "border-ink-900 bg-ink-900 text-white"
                : "border-line bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {filter.label}
            <span className="ml-1.5 text-[10px] opacity-60">
              {filter.key === "all"
                ? rows.length
                : filter.key === "scheduled"
                  ? rows.filter((row) => row.page.scheduledPublishAt || row.page.scheduledUnpublishAt).length
                  : rows.filter((row) => row.page.status === filter.key).length}
            </span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No pages yet"
          description="Start from a curated template or from a blank canvas. Either way the page stays a draft until you publish it."
          action={
            <Link href={`/admin/sites/${siteId}/pages/new`} className="btn-admin btn-admin-accent">
              Create a page
            </Link>
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-line bg-paper/70 text-[11px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Page</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Snapshots</th>
                  <th className="px-3 py-2.5 font-semibold">Updated</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filtered.map((row) => (
                  <tr key={row.page.id} className="align-middle">
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/admin/sites/${siteId}/pages/${row.page.id}`}
                          className="font-medium text-ink-900 hover:underline"
                        >
                          {row.page.title}
                        </Link>
                        {row.page.isHomepage ? <span className="badge badge-blue">home</span> : null}
                      </div>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">/{row.page.slug}</p>
                      {row.page.scheduledPublishAt ? (
                        <p className="mt-1 text-[11px] text-amber-700">
                          Publishes {new Date(row.page.scheduledPublishAt).toLocaleString("en-GB")}
                        </p>
                      ) : null}
                      {row.page.scheduledUnpublishAt ? (
                        <p className="text-[11px] text-amber-700">
                          Unpublishes {new Date(row.page.scheduledUnpublishAt).toLocaleString("en-GB")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge status={row.page.status} />
                    </td>
                    <td className="px-3 py-3 text-slate-500">{row.versionCount}</td>
                    <td className="px-3 py-3 text-[12px] text-slate-500">{relativeTime(row.page.updatedAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Link
                          href={`/edit/${siteId}/${row.page.id}`}
                          className="btn-admin btn-admin-primary !px-2.5 !py-1 !text-[11px]"
                        >
                          Edit
                        </Link>
                        <Link
                          href={`/admin/sites/${siteId}/pages/${row.page.id}`}
                          className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                        >
                          Settings
                        </Link>
                        <a
                          href={`/preview/${siteId}/${row.page.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                        >
                          Preview ↗
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                      Nothing in this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
