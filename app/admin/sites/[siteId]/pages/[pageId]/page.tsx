import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { getPage, listVersions } from "@/lib/pages";
import { listMedia } from "@/lib/media";
import { requireActor } from "@/lib/auth/session";
import { rollbackAction } from "@/lib/actions/pages";
import { PageHeader, Panel, StatusBadge, relativeTime } from "@/components/admin/ui";
import { PageSettings } from "@/components/admin/page-settings";
import { ActionButton } from "@/components/admin/action";

export const dynamic = "force-dynamic";

export default async function PageSettingsPage({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const { siteId, pageId } = await params;
  await requireActor();
  const [site, page] = await Promise.all([getSite(siteId), getPage(siteId, pageId)]);
  if (!site || !page) notFound();
  const [versions, media] = await Promise.all([listVersions(pageId), listMedia(siteId)]);

  return (
    <div>
      <PageHeader
        eyebrow={`/${page.slug}`}
        title={page.title}
        description="Page settings, search tags, scheduling and the full snapshot history."
        breadcrumb={[
          { label: site.name, href: `/admin/sites/${siteId}` },
          { label: "Pages", href: `/admin/sites/${siteId}/pages` },
          { label: page.title },
        ]}
        actions={
          <>
            <StatusBadge status={page.status} />
            <a
              href={`/preview/${siteId}/${page.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn-admin btn-admin-secondary"
            >
              Preview ↗
            </a>
            <Link href={`/edit/${siteId}/${pageId}`} className="btn-admin btn-admin-primary">
              Open editor
            </Link>
          </>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <PageSettings
          siteId={siteId}
          pageId={pageId}
          page={{ title: page.title, slug: page.slug, status: page.status }}
          seo={page.seo}
          status={page.status}
          isHomepage={page.isHomepage}
          media={media.map((asset) => ({ id: asset.id, url: asset.publicUrl, alt: asset.altText }))}
          scheduledPublishAt={page.scheduledPublishAt ? page.scheduledPublishAt.toISOString() : null}
          scheduledUnpublishAt={page.scheduledUnpublishAt ? page.scheduledUnpublishAt.toISOString() : null}
        />

        <div className="space-y-5">
          <Panel title="Version history" description="Snapshots are immutable. Rollback republishes an old one as a new version.">
            <ol className="space-y-2">
              {versions.map((version) => {
                const current = version.id === page.currentPublishedVersionId;
                return (
                  <li key={version.id} className="rounded-lg border border-line px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[13px] font-semibold text-ink-900">
                          v{version.versionNumber}
                          {current ? <span className="badge badge-green ml-2">live</span> : null}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {version.source.replace(/_/g, " ")} · {version.document.content.length} sections ·{" "}
                          {relativeTime(version.publishedAt)}
                        </p>
                      </div>
                      <ActionButton
                        action={rollbackAction}
                        payload={{ siteId, pageId, versionId: version.id }}
                        className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                        pendingLabel="Rolling back…"
                        confirm={`Roll back to version ${version.versionNumber}? It republishes that snapshot as a new version.`}
                      >
                        Restore
                      </ActionButton>
                    </div>
                  </li>
                );
              })}
              {versions.length === 0 ? (
                <li className="text-sm text-slate-500">No snapshots yet — publish the page to create the first one.</li>
              ) : null}
            </ol>
          </Panel>

          <Panel title="Concurrency" description="Every save carries the expected counter, so two editors cannot silently overwrite each other.">
            <dl className="space-y-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Lock version</dt>
                <dd className="font-mono text-ink-900">{page.lockVersion}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Current snapshot</dt>
                <dd className="font-mono text-[11px] text-slate-600">
                  {page.currentPublishedVersionId ? page.currentPublishedVersionId.slice(0, 8) : "none"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Created</dt>
                <dd className="text-slate-600">{relativeTime(page.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Last edit</dt>
                <dd className="text-slate-600">{relativeTime(page.updatedAt)}</dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
