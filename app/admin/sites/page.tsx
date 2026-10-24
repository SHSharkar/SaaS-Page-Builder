import Link from "next/link";
import { can, hasRecentStepUp, requireView } from "@/lib/auth/session";
import { listSites } from "@/lib/sites";
import { listDeletedSitesForAdmin } from "@/lib/actions/sites";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { StepUpNotice } from "@/components/admin/step-up-notice";
import { DeletedSitesPanel } from "@/components/admin/sites-trash-modal";
import { adminButtonVariants, adminPanelClass } from "@/lib/theme-classes";
import type { SiteTheme } from "@/lib/documents";

const PALETTE_SWATCH: Record<NonNullable<SiteTheme["palette"]>, string> = {
  "obsidian-gold": "bg-zinc-950 text-amber-400",
  "emerald-casino": "bg-emerald-950 text-emerald-300",
  "midnight-neon": "bg-slate-950 text-violet-300",
  "ivory-editorial": "bg-stone-100 text-amber-800 border border-stone-300",
};

export default async function SitesIndexPage() {
  const actor = await requireView("site.view", "/admin/sites");
  const canRestore = can(actor, "site.restore");
  const canPurge = can(actor, "site.purge");

  const [sites, deletedRaw, steppedUp] = await Promise.all([
    listSites(),
    canRestore || canPurge ? listDeletedSitesForAdmin() : Promise.resolve([]),
    canRestore || canPurge ? hasRecentStepUp(actor) : Promise.resolve(false),
  ]);

  const nowMs = Date.now();
  const deleted = deletedRaw.map((entry) => ({
    id: entry.site.id,
    name: entry.site.name,
    slug: entry.site.slug,
    deletedAt: entry.site.deletedAt?.toISOString() ?? null,
    purgeAfter: entry.restorableUntil?.toISOString() ?? null,
    daysLeft: entry.restorableUntil
      ? Math.max(0, Math.ceil((entry.restorableUntil.getTime() - nowMs) / 86_400_000))
      : 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Multi-brand directory"
        title="Sites"
        description="Each site isolates its pages, versions, global header/footer, media library, and verified domains."
        actions={
          can(actor, "site.create") ? (
            <Link href="/admin/sites/new" className={adminButtonVariants({ tone: "primary" })}>
              + Create site
            </Link>
          ) : null
        }
      />

      {sites.length === 0 ? (
        <EmptyState
          title="No active sites yet"
          description="Create your first brand site to get a built-in subdomain, default header and footer, and starter homepage."
          action={
            can(actor, "site.create") ? (
              <Link href="/admin/sites/new" className={adminButtonVariants({ tone: "primary" })}>
                Create first site
              </Link>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sites.map(({ site, primaryDomain, pageCount, publishedCount }) => {
            const swatch =
              PALETTE_SWATCH[site.theme.palette ?? "obsidian-gold"] ??
              PALETTE_SWATCH["obsidian-gold"];
            return (
              <Link
                key={site.id}
                href={`/admin/sites/${site.id}`}
                className={`${adminPanelClass} flex flex-col justify-between p-5 transition hover:border-slate-300`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg text-sm font-black ${swatch}`}
                      >
                        {(site.theme.logoText || site.name).slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <h2 className="text-base font-semibold text-slate-950">{site.name}</h2>
                        <p className="font-mono text-xs text-slate-400">
                          {primaryDomain ?? site.slug}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={site.status} />
                  </div>
                  {site.theme.tagline ? (
                    <p className="mt-3 text-xs leading-relaxed text-slate-500">
                      {site.theme.tagline}
                    </p>
                  ) : null}
                </div>
                <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <span>
                    <strong className="text-slate-900">{publishedCount}</strong> published /{" "}
                    {pageCount} pages
                  </span>
                  <span className="font-medium text-slate-900">Open workspace</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {(canRestore || canPurge) && deleted.length > 0 ? (
        <Panel
          title={`Recently deleted sites (${deleted.length})`}
          description="Deleted sites remain restorable for 30 days before the daily sweeper purges them permanently."
        >
          <div className="space-y-4">
            {!steppedUp ? <StepUpNotice compact /> : null}
            <DeletedSitesPanel
              deleted={deleted}
              canRestore={canRestore}
              canPurge={canPurge}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
