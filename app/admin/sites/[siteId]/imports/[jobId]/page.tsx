import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { getImportJob } from "@/lib/importer";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, Panel, StatusBadge, relativeTime } from "@/components/admin/ui";
import { ImportReview } from "@/components/admin/import-review";
import { searchCatalog } from "@/lib/registry";
import { slugify } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function ImportReviewPage({
  params,
}: {
  params: Promise<{ siteId: string; jobId: string }>;
}) {
  const { siteId, jobId } = await params;
  await requireActor();
  const [site, job] = await Promise.all([getSite(siteId), getImportJob(siteId, jobId)]);
  if (!site || !job) notFound();

  const mapping = job.mappingResult;
  const aliases = searchCatalog("", { excludeSiteFrame: true }).map((block) => ({
    alias: block.alias,
    name: block.name,
    group: block.group,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Import review"
        title={job.sourceName}
        description={`Analysed ${relativeTime(job.createdAt)}. Review the mapping, then apply it as an unpublished draft.`}
        breadcrumb={[
          { label: site.name, href: `/admin/sites/${siteId}` },
          { label: "Imports", href: `/admin/sites/${siteId}/imports` },
          { label: job.sourceName },
        ]}
        actions={<StatusBadge status={job.status} />}
      />

      {!mapping ? (
        <Panel title="Nothing to review yet">
          <p className="text-sm text-slate-500">
            This job has no mapping.{" "}
            <Link href={`/admin/sites/${siteId}/imports`} className="underline">
              Start a new import
            </Link>
            .
          </p>
        </Panel>
      ) : (
        <ImportReview
          siteId={siteId}
          jobId={job.id}
          segments={mapping.segments}
          unmapped={mapping.unmapped}
          aliases={aliases}
          counts={mapping.counts}
          defaultTitle={mapping.pageTitle || job.sourceName.replace(/\.[a-z0-9]+$/i, "")}
          defaultSlug={slugify(mapping.pageTitle || job.sourceName.replace(/\.[a-z0-9]+$/i, ""))}
        />
      )}
    </div>
  );
}
