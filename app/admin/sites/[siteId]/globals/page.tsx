import Link from "next/link";
import { notFound } from "next/navigation";
import { can, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { GLOBAL_INFO, ensureDefaultGlobals, listSiteContents } from "@/lib/globals";
import { Panel, relativeTime } from "@/components/admin/ui";
import { adminButtonVariants } from "@/lib/theme-classes";

export default async function SiteGlobalsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const actor = await requireView("globals.view", `/admin/sites/${siteId}/globals`);
  const site = await getSite(siteId);
  if (!site) notFound();

  await ensureDefaultGlobals(siteId, site.name);
  const rows = await listSiteContents(siteId);
  const canManage = can(actor, "globals.edit");

  return (
    <div className="space-y-6">
      <Panel
        title="Site-wide global content"
        description="Edited in the same visual canvas as pages. Publishing updates every live page on this site."
        actions={
          canManage ? (
            <Link
              href={`/admin/sites/${siteId}/globals/defaults`}
              className={adminButtonVariants({ tone: "secondary", size: "sm" })}
            >
              Reset to defaults
            </Link>
          ) : null
        }
      >
        <div className="divide-y divide-slate-200">
          {rows.map((row) => {
            const info = GLOBAL_INFO[row.kind];
            const blockCount = row.draftDocument?.content?.length ?? 0;
            return (
              <div
                key={row.kind}
                className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
              >
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{info.label}</h3>
                  <p className="mt-0.5 text-xs text-slate-500">{info.description}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {blockCount} block{blockCount === 1 ? "" : "s"} | updated{" "}
                    {relativeTime(row.updatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/preview/${siteId}/globals/${row.kind}`}
                    target="_blank"
                    className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                  >
                    Preview
                  </Link>
                  <Link
                    href={`/edit/${siteId}/globals/${row.kind}`}
                    className={adminButtonVariants({ tone: "primary", size: "sm" })}
                  >
                    {canManage ? "Edit" : "View"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
