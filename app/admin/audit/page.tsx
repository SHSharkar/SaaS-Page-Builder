import Link from "next/link";
import { listAudit } from "@/lib/audit";
import { listSites } from "@/lib/sites";
import { requireView } from "@/lib/auth/session";
import { PageHeader, Panel, relativeTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

const ACTION_TONE: Record<string, string> = {
  page_published: "badge-green",
  globals_published: "badge-green",
  page_rolled_back: "badge-blue",
  page_unpublished: "badge-amber",
  page_archived: "badge-gray",
  page_scheduled: "badge-blue",
  domain_verified: "badge-green",
  domain_failed: "badge-red",
  media_delete_blocked: "badge-red",
  sign_in_failed: "badge-red",
  site_suspended: "badge-red",
  site_deleted: "badge-red",
  import_applied: "badge-green",
  import_discarded: "badge-gray",
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; limit?: string }>;
}) {
  await requireView("audit.view");
  const { site = "", limit = "100" } = await searchParams;
  const [sites, entries] = await Promise.all([
    listSites(),
    listAudit({ siteId: site || undefined, limit: Math.min(Number(limit) || 100, 400) }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Append-only, retained for 24 months. Every publish, rollback, role change and blocked deletion is recorded with the actor's role at the time."
        actions={<span className="badge badge-gray">{entries.length} shown</span>}
      />
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link
          href="/admin/audit"
          className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
            !site ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-slate-600"
          }`}
        >
          Every site
        </Link>
        {sites.map((row) => (
          <Link
            key={row.site.id}
            href={`/admin/audit?site=${row.site.id}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              site === row.site.id ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-slate-600"
            }`}
          >
            {row.site.name}
          </Link>
        ))}
      </div>
      <Panel>
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nothing recorded under this filter.</p>
        ) : (
          <ol className="divide-y divide-line">
            {entries.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${ACTION_TONE[entry.action] ?? "badge-gray"}`}>
                      {entry.action.replace(/_/g, " ")}
                    </span>
                    {entry.siteName ? (
                      <Link
                        href={`/admin/audit?site=${entry.siteId ?? ""}`}
                        className="text-[11px] text-slate-500 underline hover:text-ink-900"
                      >
                        {entry.siteName}
                      </Link>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-ink-900">{entry.summary}</p>
                  <p className="text-[11px] text-slate-400">
                    {entry.actorName ?? "System"}
                    {entry.actorRoleSnapshot ? ` · ${entry.actorRoleSnapshot}` : ""}
                    {entry.targetType ? ` · ${entry.targetType}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-500">{relativeTime(entry.createdAt)}</p>
                  <p className="font-mono text-[10px] text-slate-300">
                    {new Date(entry.createdAt).toISOString().slice(0, 19).replace("T", " ")}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
