import Link from "next/link";
import { platformOverview } from "@/lib/overview";
import { listSites, platformHost } from "@/lib/sites";
import { listAudit } from "@/lib/audit";
import { primaryRole } from "@/lib/auth/session";
import { requireView } from "@/lib/auth/session";
import { PageHeader, Panel, Stat, StatusBadge, relativeTime } from "@/components/admin/ui";
import { REGISTRY_STATS } from "@/lib/registry";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;
  const actor = await requireView("site.view");
  const [overview, sites, activity] = await Promise.all([platformOverview(), listSites(), listAudit({ limit: 8 })]);

  return (
    <div>
      <PageHeader
        eyebrow={`Signed in as ${primaryRole(actor)?.name ?? "staff"}`}
        title={`Good to see you, ${actor.user.name.split(" ")[0]}`}
        description="Everything the team has shipped, everything waiting on a decision. Publishing is always one click away."
        actions={
          <>
            <Link href="/admin/sites/new" className="btn-admin btn-admin-secondary">
              New site
            </Link>
            {sites[0] ? (
              <Link href={`/admin/sites/${sites[0].site.id}/pages/new`} className="btn-admin btn-admin-primary">
                Start a page
              </Link>
            ) : null}
          </>
        }
      />

      {denied ? (
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-900">
          That screen needs the <strong>{denied}</strong> permission, which your roles do not include. An admin can
          grant it on <Link href="/admin/roles" className="underline">Roles &amp; permissions</Link>.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sites" value={overview.sites} hint={`${overview.domains} domains connected`} href="/admin/sites" />
        <Stat label="Published pages" value={overview.published} hint={`${overview.drafts} drafts in progress`} />
        <Stat label="Snapshots kept" value={overview.versions} hint="Rollback ready, 50 per page" />
        <Stat label="Media assets" value={overview.media} hint="Deduplicated by content hash" />
      </div>

      {(overview.importsInReview > 0 || overview.pendingDomains > 0 || overview.pendingInvites > 0) && (
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {overview.importsInReview > 0 ? (
            <Link href="/admin/sites" className="panel px-4 py-3 text-sm transition hover:border-slate-300">
              <span className="badge badge-amber">{overview.importsInReview} to review</span>
              <p className="mt-2 font-medium text-ink-900">Imports waiting for a human</p>
              <p className="text-xs text-slate-500">Mapping is a proposal until someone approves it.</p>
            </Link>
          ) : null}
          {overview.pendingDomains > 0 ? (
            <div className="panel px-4 py-3 text-sm">
              <span className="badge badge-blue">{overview.pendingDomains} verifying</span>
              <p className="mt-2 font-medium text-ink-900">Domains in DNS verification</p>
              <p className="text-xs text-slate-500">The platform address keeps serving meanwhile.</p>
            </div>
          ) : null}
          {overview.pendingInvites > 0 ? (
            <Link href="/admin/team" className="panel px-4 py-3 text-sm transition hover:border-slate-300">
              <span className="badge badge-gray">{overview.pendingInvites} pending</span>
              <p className="mt-2 font-medium text-ink-900">Invitations out</p>
              <p className="text-xs text-slate-500">Single-use links, seven-day window.</p>
            </Link>
          ) : null}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Sites"
          description="Each site owns its pages, navigation, footer, theme and domains."
          actions={
            <Link href="/admin/sites" className="text-xs font-medium text-slate-500 underline hover:text-ink-900">
              View all
            </Link>
          }
        >
          <div className="space-y-2">
            {sites.map((row) => (
              <div
                key={row.site.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/sites/${row.site.id}`}
                      className="truncate text-sm font-semibold text-ink-900 hover:underline"
                    >
                      {row.site.name}
                    </Link>
                    <StatusBadge status={row.site.status} />
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                    {platformHost(row.site.slug)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-[11px] text-slate-500">
                  <span>{row.pageCount} pages</span>
                  <span className="text-green-700">{row.publishedCount} live</span>
                  <Link
                    href={`/admin/sites/${row.site.id}/pages`}
                    className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))}
            {sites.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">No sites yet.</p>
            ) : null}
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Recently shipped" description="The last eight audited actions.">
            <ol className="space-y-3">
              {activity.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-[13px] leading-snug text-ink-900">{entry.summary}</p>
                    <p className="text-[11px] text-slate-400">
                      {entry.actorName ?? "System"} · {relativeTime(entry.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
              {activity.length === 0 ? <li className="text-sm text-slate-500">Nothing yet.</li> : null}
            </ol>
          </Panel>

          <Panel title="Component library" description="One definition drives the editor, importer and renderer.">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold text-ink-900">{REGISTRY_STATS.launch}</p>
                <p className="text-xs text-slate-500">components across {REGISTRY_STATS.groups} groups</p>
              </div>
              <Link href="/admin/components" className="btn-admin btn-admin-secondary !py-1.5 !text-xs">
                Browse
              </Link>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
