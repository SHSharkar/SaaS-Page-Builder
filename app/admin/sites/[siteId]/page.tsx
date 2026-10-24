import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite, listSiteDomains, siteCounts, platformHost } from "@/lib/sites";
import { listPages } from "@/lib/pages";
import { listSiteContents, GLOBAL_LABELS, type GlobalKind } from "@/lib/globals";
import { listAudit } from "@/lib/audit";
import { requireView } from "@/lib/auth/session";
import { Panel, Stat, StatusBadge, relativeTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function SiteOverviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireView("site.view");
  const site = await getSite(siteId);
  if (!site) notFound();

  const [counts, pages, contents, domains, activity] = await Promise.all([
    siteCounts(siteId),
    listPages(siteId),
    listSiteContents(siteId),
    listSiteDomains(siteId),
    listAudit({ siteId, limit: 6 }),
  ]);

  const homepage = pages.find((row) => row.page.isHomepage);
  const kinds: GlobalKind[] = ["navigation", "footer", "defaults"];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Pages"
          value={counts.pages}
          hint={`${counts.published} live · ${counts.drafts} drafts`}
          href={`/admin/sites/${siteId}/pages`}
        />
        <Stat label="Snapshots" value={counts.versions} hint="Immutable, 50 kept per page" />
        <Stat label="Media" value={counts.media} hint="Hashed on upload, deduplicated" href={`/admin/sites/${siteId}/media`} />
        <Stat
          label="Hostnames"
          value={counts.domains}
          hint={domains.find((domain) => domain.isPrimary)?.hostname ?? platformHost(site.slug)}
          href={`/admin/sites/${siteId}/domains`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Pages"
          description="Drafts are private until published. Publication writes an immutable snapshot."
          actions={
            <Link href={`/admin/sites/${siteId}/pages`} className="text-xs font-medium text-slate-500 underline hover:text-ink-900">
              All pages
            </Link>
          }
        >
          <ul className="divide-y divide-line">
            {pages.slice(0, 6).map((row) => (
              <li key={row.page.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/sites/${siteId}/pages/${row.page.id}`}
                      className="truncate text-sm font-medium text-ink-900 hover:underline"
                    >
                      {row.page.title}
                    </Link>
                    {row.page.isHomepage ? <span className="badge badge-blue">home</span> : null}
                    <StatusBadge status={row.page.status} />
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400">/{row.page.slug}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/edit/${siteId}/${row.page.id}`}
                    className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                  >
                    Edit
                  </Link>
                </div>
              </li>
            ))}
            {pages.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">
                No pages yet.{" "}
                <Link href={`/admin/sites/${siteId}/pages/new`} className="text-ink-900 underline">
                  Create the first page
                </Link>
                .
              </li>
            ) : null}
          </ul>
        </Panel>

        <div className="space-y-5">
          <Panel
            title="Live now"
            description="What a visitor sees on the primary hostname."
            footer={
              <a href={`/preview/${siteId}`} target="_blank" rel="noreferrer" className="font-medium text-slate-600 underline">
                Open staff preview
              </a>
            }
          >
            <dl className="space-y-2 text-[13px]">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Homepage</dt>
                <dd className="truncate font-medium text-ink-900">{homepage ? homepage.page.title : "Not published"}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Primary host</dt>
                <dd className="truncate font-mono text-[11px] text-slate-600">
                  {domains.find((domain) => domain.isPrimary)?.hostname ?? platformHost(site.slug)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Theme accent</dt>
                <dd className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
                  <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: site.theme.accent }} />
                  {site.theme.accent}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-slate-500">Sitemap / robots</dt>
                <dd className="font-mono text-[11px] text-slate-600">/sitemap.xml · /robots.txt</dd>
              </div>
            </dl>
          </Panel>

          <Panel title="Global content" description="Header, footer and default SEO are edited once per site.">
            <ul className="space-y-2">
              {kinds.map((kind) => {
                const content = contents.find((row) => row.kind === kind);
                const published = Boolean(content?.publishedDocument);
                const dirty = Boolean(content?.draftDocument) && !published;
                return (
                  <li key={kind} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink-900">{GLOBAL_LABELS[kind]}</p>
                      <p className="text-[11px] text-slate-400">
                        {published
                          ? `Published ${relativeTime(content?.publishedAt)}`
                          : dirty
                            ? "Draft saved, not published"
                            : "Using built-in defaults"}
                      </p>
                    </div>
                    <Link
                      href={`/edit/${siteId}/globals/${kind}`}
                      className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                    >
                      Edit
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Panel
          title="Hostnames"
          description="A hostname serves only after it verifies."
          actions={
            <Link href={`/admin/sites/${siteId}/domains`} className="text-xs font-medium text-slate-500 underline hover:text-ink-900">
              Manage
            </Link>
          }
        >
          <ul className="space-y-2">
            {domains.map((domain) => (
              <li key={domain.id} className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-mono text-[12px] text-ink-900">{domain.hostname}</p>
                  <p className="text-[11px] text-slate-400">
                    {domain.kind === "custom" ? "Custom domain" : "Platform subdomain"}
                    {domain.isPrimary ? " · primary" : ""}
                  </p>
                </div>
                <StatusBadge status={domain.status} />
              </li>
            ))}
            {domains.length === 0 ? <li className="text-sm text-slate-500">No hostnames yet.</li> : null}
          </ul>
        </Panel>

        <Panel
          title="Activity"
          description="Append-only audit trail for this site."
          actions={
            <Link href={`/admin/audit?site=${siteId}`} className="text-xs font-medium text-slate-500 underline hover:text-ink-900">
              Full log
            </Link>
          }
        >
          <ol className="space-y-3">
            {activity.map((entry) => (
              <li key={entry.id} className="flex gap-2.5">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug text-ink-900">{entry.summary}</p>
                  <p className="text-[11px] text-slate-400">
                    {entry.actorName ?? "System"} · {relativeTime(entry.createdAt)}
                  </p>
                </div>
              </li>
            ))}
            {activity.length === 0 ? <li className="text-sm text-slate-500">Nothing logged yet.</li> : null}
          </ol>
        </Panel>
      </div>
    </div>
  );
}
