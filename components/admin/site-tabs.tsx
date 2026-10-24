"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function SiteTabs({ siteId }: { siteId: string }) {
  const pathname = usePathname();
  const base = `/admin/sites/${siteId}`;
  const tabs = [
    { href: base, label: "Overview", exact: true },
    { href: `${base}/pages`, label: "Pages" },
    { href: `${base}/globals`, label: "Global content" },
    { href: `${base}/media`, label: "Media" },
    { href: `${base}/domains`, label: "Domains" },
    { href: `${base}/imports`, label: "Imports" },
    { href: `${base}/settings`, label: "Settings" },
  ];

  return (
    <div className="-mx-1 mb-6 overflow-x-auto border-b border-slate-200">
      <nav className="flex min-w-max gap-1 px-1" aria-label="Site sections">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition ${
                active
                  ? "border-slate-950 text-slate-950"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-950"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
