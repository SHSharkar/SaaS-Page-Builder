import { requireView } from "@/lib/auth/session";
import { listAudit } from "@/lib/audit";
import { listSites } from "@/lib/sites";
import { PageHeader, Panel } from "@/components/admin/ui";
import { adminButtonVariants, adminSelectClass } from "@/lib/theme-classes";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  await requireView("audit.view", "/admin/audit");
  const { siteId } = await searchParams;
  const [entries, allSites] = await Promise.all([
    listAudit({ siteId: siteId || undefined, limit: 150 }),
    listSites(),
  ]);
  const siteNameById = new Map(allSites.map((entry) => [entry.site.id, entry.site.name]));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance & accountability"
        title="Audit log"
        description="Append-only record of publishing, role changes, domain operations, and staff security events."
      />

      <Panel
        title={`Showing ${entries.length} recent event${entries.length === 1 ? "" : "s"}`}
        actions={
          <form method="get" className="flex items-center gap-2">
            <select
              name="siteId"
              defaultValue={siteId ?? ""}
              className={`${adminSelectClass} w-auto py-1.5 text-xs`}
              aria-label="Filter by site"
            >
              <option value="">All sites & platform</option>
              {allSites.map((entry) => (
                <option key={entry.site.id} value={entry.site.id}>
                  {entry.site.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className={adminButtonVariants({ tone: "secondary", size: "sm" })}
            >
              Filter
            </button>
          </form>
        }
      >
        {entries.length === 0 ? (
          <p className="text-xs text-slate-500">No audit entries match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Scope</th>
                  <th className="py-2">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((row) => (
                  <tr key={row.id} className="align-top">
                    <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-[11px] text-slate-500">
                      {row.createdAt.toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700">{row.actorEmail ?? "system"}</td>
                    <td className="whitespace-nowrap py-2.5 pr-4 font-mono text-[11px] text-slate-600">
                      {row.action}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">
                      {row.siteId ? (siteNameById.get(row.siteId) ?? row.siteId) : "platform"}
                    </td>
                    <td className="py-2.5 text-slate-900">{row.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
