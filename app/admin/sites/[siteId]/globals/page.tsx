import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { listSiteContents, GLOBAL_LABELS, type GlobalKind } from "@/lib/globals";
import { requireView } from "@/lib/auth/session";
import { PageHeader, Panel, StatusBadge, relativeTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const DESCRIPTIONS: Record<GlobalKind, string> = {
  navigation: "The header that appears at the top of every page: logo, links and the primary call to action.",
  footer: "The footer shared by every page: legal links, licence line, social links and contact details.",
  defaults: "Site-wide default SEO tags used whenever a page leaves a field blank.",
};

export default async function SiteGlobalsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireView("globals.view");
  const site = await getSite(siteId);
  if (!site) notFound();
  const contents = await listSiteContents(siteId);
  const kinds: GlobalKind[] = ["navigation", "footer", "defaults"];

  return (
    <div>
      <PageHeader
        title="Global content"
        description="Header, footer and default tags are edited once per site. Each keeps its own draft until you publish it."
        breadcrumb={[{ label: site.name, href: `/admin/sites/${siteId}` }, { label: "Global content" }]}
      />

      <div className="grid gap-4 md:grid-cols-3">
        {kinds.map((kind) => {
          const content = contents.find((row) => row.kind === kind);
          const draft = content?.draftDocument ?? null;
          const published = content?.publishedDocument ?? null;
          const dirty = Boolean(draft) && JSON.stringify(draft) !== JSON.stringify(published);
          return (
            <Panel key={kind} title={GLOBAL_LABELS[kind]} description={DESCRIPTIONS[kind]}>
              <div className="space-y-2 text-[12px] text-slate-500">
                <p className="flex items-center gap-2">
                  <StatusBadge status={published ? "published" : "draft"} label={published ? "Published" : "Defaults"} />
                  {dirty ? <span className="badge badge-amber">Unpublished changes</span> : null}
                </p>
                <p>
                  {draft ? `${draft.content.length} block${draft.content.length === 1 ? "" : "s"} in the draft` : "Nothing drafted yet"}
                </p>
                <p>
                  {content?.publishedAt
                    ? `Published ${relativeTime(content.publishedAt)}`
                    : "Never published — built-in defaults are used"}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={kind === "defaults" ? `/admin/sites/${siteId}/globals/defaults` : `/edit/${siteId}/globals/${kind}`}
                  className="btn-admin btn-admin-primary !py-1.5 !text-xs"
                >
                  {kind === "defaults" ? "Edit tags" : "Edit in visual editor"}
                </Link>
              </div>
            </Panel>
          );
        })}
      </div>

      <Panel
        className="mt-5"
        title="How global content reaches visitors"
        description="The renderer resolves the published globals on every request, then caches the site document under site:{id}:globals."
      >
        <ul className="space-y-1.5 text-[13px] text-slate-600">
          <li>· Publishing globals clears every page cache for the site in the same request.</li>
          <li>· A page can hide the header or footer individually from its editor root settings.</li>
          <li>· Staff previews always show the draft, never the published copy.</li>
        </ul>
      </Panel>
    </div>
  );
}
