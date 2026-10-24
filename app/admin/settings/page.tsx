import { desc } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { requireView, can } from "@/lib/auth/session";
import { countActiveStaffAtRank } from "@/lib/auth/rbac";
import { listRecentJobs } from "@/lib/queue";
import { cleanupPreview } from "@/lib/retention";
import { KEEP } from "@/lib/lifecycle";
import { storageInfo } from "@/lib/media/storage";
import { PageHeader, Panel, StatusBadge, relativeTime } from "@/components/admin/ui";
import { PlatformSettings } from "@/components/admin/platform-settings";

export const dynamic = "force-dynamic";

export default async function PlatformSettingsPage() {
  const actor = await requireView("settings.view");
  await ensureDb();
  const rows = await db.select().from(platformSettings).orderBy(desc(platformSettings.key));
  const jobs = await listRecentJobs(12);

  const admins = await countActiveStaffAtRank(100);
  const preview = await cleanupPreview();
  const storage = storageInfo();

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Settings"
        description="Runtime knobs, worker controls and the environment this instance is running in. Guarded by the admin role."
        actions={
          <span className="badge badge-gray">
            {actor.roles.length ? actor.roles.map((role) => role.name).join(" · ") : "no role"}
          </span>
        }
      />
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <PlatformSettings
          preview={preview}
          keepWindows={[
            { label: "Audit log", value: `${KEEP.auditMonths} months` },
            { label: "Snapshots per page", value: String(KEEP.versionsPerPage) },
            { label: "Import jobs", value: `${KEEP.importJobDays} days` },
            { label: "Import files", value: `${KEEP.importFileMonths} months` },
            { label: "Unconfirmed uploads", value: `${KEEP.pendingMediaHours} hours` },
            { label: "Deleted site, restorable", value: `${KEEP.siteRestoreDays} days` },
            { label: "Removed hostname", value: `${KEEP.removedDomainDays} days` },
            { label: "Suspended site review", value: `${KEEP.suspendedReviewMonths} months` },
          ]}
          settings={rows.map((row) => ({
            key: row.key,
            value: row.isSecret ? "••••••••" : JSON.stringify(row.value).replace(/^"|"$/g, ""),
            isSecret: row.isSecret,
            updatedAt: row.updatedAt.toISOString(),
          }))}
        />
        <div className="space-y-5">
          <Panel title="Environment" description="What this instance is actually running on.">
            <dl className="space-y-1.5 text-[12px]">
              {[
                ["Node", process.version],
                ["NODE_ENV", process.env.NODE_ENV ?? "development"],
                ["Host fallback", process.env.ALLOW_HOST_FALLBACK === "false" ? "disabled" : "first active site"],
                ["Media store", storage.backend === "r2" ? `R2 · ${storage.bucket}` : storage.mediaDir ?? "./data/media"],
                ["Database", `PGlite · ${process.env.PGLITE_DIR ?? "./data/pg"}`],
                ["Active admins", String(admins)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="truncate font-mono text-[11px] text-slate-700">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Panel title="Recent jobs" description="The queue lives in the database with a unique dedupe key.">
            <ul className="space-y-2">
              {jobs.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-ink-900">{job.kind}</p>
                    <p className="text-[10px] text-slate-400">
                      {relativeTime(job.createdAt)} · attempts {job.attempts}/{job.maxAttempts}
                      {job.lastError ? ` · ${job.lastError.slice(0, 60)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={job.status} />
                </li>
              ))}
              {jobs.length === 0 ? <li className="text-sm text-slate-500">Queue is empty.</li> : null}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
