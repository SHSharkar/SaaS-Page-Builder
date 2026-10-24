import type { ReactNode } from "react";
import Link from "next/link";
import { can, requireActor } from "@/lib/auth/session";
import { signOutAction } from "@/lib/actions/auth";
import { stopImpersonatingAction } from "@/lib/actions/team";
import { MobileNav, SidebarNav, type NavItem } from "@/components/admin/nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireActor();

  const items: NavItem[] = [{ href: "/admin", label: "Overview", exact: true }];
  if (can(actor, "site.view")) items.push({ href: "/admin/sites", label: "Sites" });
  if (can(actor, "template.view")) items.push({ href: "/admin/templates", label: "Templates" });
  if (can(actor, "page.view")) items.push({ href: "/admin/components", label: "Components" });
  if (can(actor, "staff.view")) items.push({ href: "/admin/team", label: "Team" });
  if (can(actor, "role.view")) items.push({ href: "/admin/roles", label: "Roles & permissions" });
  if (can(actor, "audit.view")) items.push({ href: "/admin/audit", label: "Audit log" });
  if (can(actor, "settings.view")) items.push({ href: "/admin/settings", label: "Platform" });
  items.push({ href: "/admin/account", label: "Your account" });

  return (
    <div className="min-h-screen bg-slate-50">
      {actor.impersonatedBy ? (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-400 px-4 py-2 text-xs font-medium text-slate-950">
          <span>
            Viewing the workspace as <strong>{actor.user.name}</strong> ({actor.user.email}) on
            the <strong>{actor.role?.name ?? actor.user.role}</strong> role.
          </span>
          <form action={stopImpersonatingAction}>
            <button
              type="submit"
              className="rounded-md bg-slate-950 px-2.5 py-1 text-[11px] font-semibold text-white"
            >
              Return to your own account
            </button>
          </form>
        </div>
      ) : null}

      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col justify-between bg-slate-950 p-5 text-white lg:flex">
          <div>
            <Link href="/admin" className="mb-7 flex items-center gap-2.5 px-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-400 text-xs font-black text-slate-950">
                T
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight">Trofeo Pages</p>
                <p className="text-[10px] text-white/45">Staff workspace</p>
              </div>
            </Link>
            <SidebarNav items={items} />
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4 text-xs">
            <div className="px-2">
              <p className="break-words font-semibold text-white">{actor.user.name}</p>
              <p className="break-all text-[11px] text-white/50">{actor.user.email}</p>
              <span className="mt-1.5 inline-block rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                {actor.role?.name ?? actor.user.role}
              </span>
            </div>
            <div className="flex items-center justify-between px-2 pt-1 text-[11px]">
              <Link href="/" className="text-white/60 hover:text-white">
                Public site
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="text-white/60 hover:text-white">
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <div className="mb-2 flex items-center justify-between">
              <Link href="/admin" className="text-sm font-semibold text-slate-950">
                Trofeo Pages
              </Link>
              <form action={signOutAction}>
                <button type="submit" className="text-xs text-slate-500 underline">
                  Sign out
                </button>
              </form>
            </div>
            <MobileNav items={items} />
          </div>

          <main className="mx-auto w-full flex-1 px-5 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
