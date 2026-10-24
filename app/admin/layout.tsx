import Link from "next/link";
import { requireActor, primaryRole, can } from "@/lib/auth/session";
import { listSites } from "@/lib/sites";
import { signOutAction } from "@/lib/actions/auth";
import { stopImpersonatingAction } from "@/lib/actions/team";
import { MobileNav, SidebarNav, type NavItem } from "@/components/admin/nav";

export const dynamic = "force-dynamic";

/**
 * Each destination names the permission that opens it, so the sidebar shows
 * exactly what the actor can reach. The guards on the pages themselves are what
 * enforce it; this just avoids offering doors that will not open.
 */
const NAV: (NavItem & { permission?: string })[] = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/sites", label: "Sites", permission: "site.view" },
  { href: "/admin/templates", label: "Templates", permission: "template.view" },
  { href: "/admin/components", label: "Component library", permission: "catalog.view" },
  { href: "/admin/team", label: "Team", permission: "staff.view" },
  { href: "/admin/roles", label: "Roles & permissions", permission: "role.view" },
  { href: "/admin/audit", label: "Audit log", permission: "audit.view" },
  { href: "/admin/settings", label: "Platform settings", permission: "settings.view" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireActor();
  const sites = await listSites();
  const nav = NAV.filter((item) => !item.permission || can(actor, item.permission));

  return (
    <div className="admin-body min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="hidden bg-ink-900 px-4 py-5 text-white lg:flex lg:min-h-screen lg:flex-col">
        <Link href="/admin" className="flex items-center gap-2.5 px-2 pb-5">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gold-500 text-sm font-black text-ink-900">
            T
          </span>
          <div>
            <p className="text-[13px] font-semibold leading-tight">Trofēo Pages</p>
            <p className="text-[10px] leading-tight text-white/40">Internal platform</p>
          </div>
        </Link>

        <div className="mb-4 rounded-lg border border-white/10 bg-white/5 p-2.5">
          <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Sites
          </p>
          <div className="mt-1.5 space-y-0.5">
            {sites.length === 0 ? (
              <p className="px-1 py-1 text-[11px] text-white/50">No sites yet</p>
            ) : (
              sites.slice(0, 4).map((row) => (
                <Link
                  key={row.site.id}
                  href={`/admin/sites/${row.site.id}`}
                  className="flex items-center justify-between rounded-md px-1.5 py-1.5 text-[12px] text-white/75 hover:bg-white/10"
                >
                  <span className="truncate">{row.site.name}</span>
                  <span className="ml-2 shrink-0 text-[10px] text-white/35">{row.publishedCount}</span>
                </Link>
              ))
            )}
          </div>
          <Link
            href="/admin/sites/new"
            className="mt-2 flex items-center justify-center rounded-md border border-white/15 px-2 py-1.5 text-[11px] font-medium text-white/70 hover:bg-white/10"
          >
            + New site
          </Link>
        </div>

        <SidebarNav items={nav} />

        <div className="mt-auto rounded-lg border border-white/10 p-3">
          <p className="text-[12px] font-semibold text-white/90">{actor.user.name}</p>
          <p className="truncate text-[10px] text-white/40">{actor.user.email}</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gold-300">
              {primaryRole(actor)?.name ?? "No role"}
            </span>
            <span className="flex items-center gap-2">
              <Link href="/account/password" className="text-[10px] text-white/50 underline hover:text-white">
                Account
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="text-[10px] text-white/50 underline hover:text-white">
                  Sign out
                </button>
              </form>
            </span>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-30 border-b border-line bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mb-2 flex items-center justify-between">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink-900 text-xs font-black text-white">
                T
              </span>
              <span className="text-[13px] font-semibold text-ink-900">Trofēo Pages</span>
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="text-[11px] text-slate-500 underline">
                Sign out
              </button>
            </form>
          </div>
          <MobileNav items={nav} />
        </div>

        <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1200px]">
            {actor.session.impersonatedBy ? (
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold-300 bg-[#fbf6e8] px-4 py-3">
                <p className="text-[12px] text-ink-900">
                  You are signed in as <strong>{actor.user.name}</strong> through an administrator impersonation
                  session. Actions are recorded against your own account.
                </p>
                <form action={stopImpersonatingAction}>
                  <button type="submit" className="btn-admin btn-admin-primary !px-3 !py-1.5 !text-[11px]">
                    Return to my account
                  </button>
                </form>
              </div>
            ) : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
