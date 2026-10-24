"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; exact?: boolean };

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center justify-between rounded-lg px-3 py-2 text-[13px] transition ${
              active
                ? "bg-white/10 font-semibold text-white"
                : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
            {active ? <span className="h-1.5 w-1.5 rounded-full bg-gold-500" /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
              active ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-slate-600"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(value);
      }}
      className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-paper"
    >
      {label}
    </button>
  );
}
