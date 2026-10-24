import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { getPage, listVersions } from "@/lib/pages";
import { COMPONENT_MAP } from "@/lib/registry";
import { Panel, StatusBadge, relativeTime } from "@/components/admin/ui";
import { PageLifecycleBar, VersionHistoryList } from "@/components/admin/version-history";
import { adminButtonVariants } from "@/lib/theme-classes";

export default async function SitePageDetailRoute({
  params,
}: {
  params: Promise<{ siteId: string; pageId: string }>;
}) {
  const { siteId, pageId } = await params;
  const actor = await requireView("page.view", `/admin/sites/${siteId}/pages/${pageId}`);
  const site = await getSite(siteId);
  if (!site) notFound();
  const page = await getPage(siteId, pageId);
  if (!page) notFound();

  const versions = await listVersions(siteId, pageId);
  const serializedVersions = versions.map((version) => ({
    id: version.id,
    versionNumber: version.versionNumber,
    note: version.note ?? "",
    publishedAt: version.publishedAt.toISOString(),
    isCurrent: version.id === page.publishedVersionId,
    sectionCount: version.document.content?.length ?? 0,
  }));

  const draftContent = page.draftDocument.content ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-slate-950">{page.title}</h2>
            <StatusBadge status={page.status} />
          </div>
          <p className="mt-1 font-mono text-xs text-slate-400">
            {page.slug === "/" || !page.slug ? "/ (homepage)" : page.slug} | draft lock v
            {page.lockVersion} | updated {relativeTime(page.updatedAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/preview/${siteId}/${page.id}`}
            target="_blank"
            className={adminButtonVariants({ tone: "secondary" })}
          >
            Preview draft
          </Link>
          <Link
            href={`/edit/${siteId}/${page.id}`}
            className={adminButtonVariants({ tone: "primary" })}
          >
            Open visual editor
          </Link>
        </div>
      </div>

      <Panel
        title="Publishing & lifecycle"
        description="Every publish snapshots an immutable version; rolling back points live traffic to a previous snapshot and logs a new version entry."
      >
        <PageLifecycleBar
          siteId={siteId}
          pageId={page.id}
          status={page.status}
          canEdit={can(actor, "page.edit")}
          canPublish={can(actor, "page.publish")}
          canDelete={can(actor, "page.archive")}
          canSaveTemplate={can(actor, "template.create")}
        />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <Panel
            title={`Working draft outline (${draftContent.length})`}
            description="Ordered blocks currently in the draft document."
          >
            {draftContent.length === 0 ? (
              <p className="text-xs text-slate-500">Draft is empty.</p>
            ) : (
              <ol className="divide-y divide-slate-200 text-xs">
                {draftContent.map((block, index) => {
                  const def = COMPONENT_MAP[block.type];
                  return (
                    <li
                      key={block.props?.id ?? `${block.type}-${index}`}
                      className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                    >
                      <span className="font-medium text-slate-900">
                        {index + 1}. {def?.label ?? block.type}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">{block.type}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>

        <div className="lg:col-span-7">
          <Panel
            title={`Published version history (${serializedVersions.length})`}
            description="Up to 50 historical snapshots plus the active live version are kept per page."
          >
            <VersionHistoryList
              siteId={siteId}
              pageId={page.id}
              versions={serializedVersions}
              canRollback={can(actor, "page.rollback")}
            />
          </Panel>
        </div>
      </div>
    </div>
  );
}
