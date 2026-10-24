import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { listSiteImports, type ImportReport } from "@/lib/importer";
import { Panel, StatusBadge, relativeTime } from "@/components/admin/ui";
import { ImportStarter } from "@/components/admin/import-starter";
import { adminButtonVariants } from "@/lib/theme-classes";

export default async function SiteImportsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const actor = await requireView("page.view", `/admin/sites/${siteId}/imports`);
  const site = await getSite(siteId);
  if (!site) notFound();

  const jobs = await listSiteImports(siteId);
  const canCreate = can(actor, "import.create");

  return (
    <div className="space-y-6">
      {canCreate ? (
        <Panel
          title="Import static HTML into blocks"
          description="Parses legacy HTML into structured sections, strips scripts and event handlers, and opens a review screen before creating a draft."
        >
          <ImportStarter siteId={siteId} canCreate={canCreate} />
        </Panel>
      ) : null}

      <Panel
        title={`Import jobs (${jobs.length})`}
        description="Completed and pending HTML conversion jobs for this site."
      >
        {jobs.length === 0 ? (
          <p className="text-xs text-slate-500">No HTML imports have been run on this site yet.</p>
        ) : (
          <div className="divide-y divide-slate-200">
            {jobs.map((job) => {
              const report = job.report as ImportReport | null;
              return (
                <div
                  key={job.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/sites/${siteId}/imports/${job.id}`}
                        className="font-semibold text-slate-950 hover:underline"
                      >
                        {job.sourceFilename}
                      </Link>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {report
                        ? `${report.mappedCount} mapped | ${report.unmappedCount} unmapped | ${report.strippedCount} stripped`
                        : "Queued for analysis"}{" "}
                      | {relativeTime(job.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.targetPageId ? (
                      <Link
                        href={`/edit/${siteId}/${job.targetPageId}`}
                        className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                      >
                        Open draft
                      </Link>
                    ) : null}
                    <Link
                      href={`/admin/sites/${siteId}/imports/${job.id}`}
                      className={adminButtonVariants({ tone: "primary", size: "sm" })}
                    >
                      Review
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
