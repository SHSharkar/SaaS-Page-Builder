import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { getImportJob, type ImportReport } from "@/lib/importer";
import { COMPONENT_MAP } from "@/lib/registry";
import { Alert, Panel, Stat, StatusBadge } from "@/components/admin/ui";
import { ImportReview } from "@/components/admin/import-review";
import { adminButtonVariants } from "@/lib/theme-classes";

export default async function ImportJobDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; jobId: string }>;
}) {
  const { siteId, jobId } = await params;
  const actor = await requireView("import.view", `/admin/sites/${siteId}/imports/${jobId}`);
  const site = await getSite(siteId);
  if (!site) notFound();
  const job = await getImportJob(siteId, jobId);
  if (!job) notFound();

  const report = job.report as ImportReport | null;
  const mappedSegments = report ? report.segments.filter((seg) => seg.suggestedType) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-lg font-semibold text-slate-950">{job.sourceFilename}</h2>
          <StatusBadge status={job.status} />
        </div>
        <Link
          href={`/admin/sites/${siteId}/imports`}
          className={adminButtonVariants({ tone: "secondary", size: "sm" })}
        >
          All imports
        </Link>
      </div>

      {job.errorMessage ? <Alert tone="error">{job.errorMessage}</Alert> : null}

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Mapped blocks" value={report.mappedCount} />
            <Stat label="Unmapped fragments" value={report.unmappedCount} />
            <Stat label="Dangerous tags stripped" value={report.strippedCount} />
            <Stat label="Images imported" value={report.imagesImported} />
          </div>

          {report.warnings.length > 0 ? (
            <Alert tone="warning">
              <ul className="list-inside list-disc space-y-0.5 text-xs">
                {report.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </Alert>
          ) : null}

          <Panel
            title={`Mapped blocks (${mappedSegments.length})`}
            description="Sections automatically matched to registered catalog components."
          >
            {mappedSegments.length === 0 ? (
              <p className="text-xs text-slate-500">No sections matched structured components.</p>
            ) : (
              <ol className="divide-y divide-slate-200 text-xs">
                {mappedSegments.map((seg, index) => {
                  const alias = seg.suggestedType ?? "";
                  const def = COMPONENT_MAP[alias];
                  return (
                    <li
                      key={seg.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="font-medium text-slate-950">
                        {index + 1}. {def?.name ?? alias} - {seg.label}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{alias}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <Panel
            title="Review & create draft page"
            description="Accept, remap, or skip each detected section before turning this import into an editable draft."
          >
            <ImportReview
              siteId={siteId}
              jobId={job.id}
              sourceName={job.sourceFilename}
              status={job.status}
              suggestedTitle={report.title}
              segments={report.segments}
              canApply={can(actor, "import.apply")}
              allowAdminBlocks={can(actor, "catalog.admin_blocks")}
              producedPageId={job.targetPageId}
            />
          </Panel>
        </>
      ) : (
        <Panel title="Processing import">
          <p className="text-xs text-slate-500">
            This HTML source is queued for analysis by the background worker. Refresh in a moment.
          </p>
        </Panel>
      )}
    </div>
  );
}
