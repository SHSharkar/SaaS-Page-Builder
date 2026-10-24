import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { listImportJobs } from "@/lib/importer";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, Panel, StatusBadge, relativeTime, EmptyState } from "@/components/admin/ui";
import { ImportUpload } from "@/components/admin/import-upload";

export const dynamic = "force-dynamic";

export default async function SiteImportsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireActor();
  const site = await getSite(siteId);
  if (!site) notFound();
  const jobs = await listImportJobs(siteId);
  const reviewable = jobs.filter((job) => job.status === "in_review" || job.status === "mapped");

  return (
    <div>
      <PageHeader
        title="Imports"
        description="Bring in an existing landing page as HTML. The analyser proposes a component mapping; a reviewer must approve every section before a draft exists."
        breadcrumb={[{ label: site.name, href: `/admin/sites/${siteId}` }, { label: "Imports" }]}
      />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Panel title="New import" description="Five megabyte cap, one file at a time, twenty per staff member per day.">
          <ImportUpload siteId={siteId} />
        </Panel>

        <div className="space-y-4">
          {reviewable.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              {reviewable.length} import{reviewable.length === 1 ? "" : "s"} waiting for review.{" "}
              <Link href={`/admin/sites/${siteId}/imports/${reviewable[0].id}`} className="font-semibold underline">
                Review the newest
              </Link>
              .
            </div>
          ) : null}

          <Panel title="History" description="Every analysis is kept, including the ones you discard.">
            {jobs.length === 0 ? (
              <EmptyState title="No imports yet" description="Upload an HTML file to see how the analyser maps it onto the component library." />
            ) : (
              <ul className="divide-y divide-line">
                {jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-ink-900">{job.sourceName}</span>
                        <StatusBadge status={job.status} />
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {job.mappingResult
                          ? `${job.mappingResult.counts.mapped}/${job.mappingResult.counts.sections} sections mapped · `
                          : ""}
                        {relativeTime(job.createdAt)}
                      </p>
                      {job.failureReason ? (
                        <p className="mt-1 text-[11px] text-red-600">{job.failureReason}</p>
                      ) : null}
                    </div>
                    {job.status === "in_review" || job.status === "mapped" ? (
                      <Link
                        href={`/admin/sites/${siteId}/imports/${job.id}`}
                        className="btn-admin btn-admin-primary !px-2.5 !py-1 !text-[11px]"
                      >
                        Review
                      </Link>
                    ) : job.status === "applied" && job.producedPageId ? (
                      <Link
                        href={`/edit/${siteId}/${job.producedPageId}`}
                        className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                      >
                        Open page
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
