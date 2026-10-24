"use client";

import { useEffect, useState } from "react";
import { cn, siteButton } from "@/lib/theme-classes";

export function MobileNavModal({
  brand,
  links,
  ctaLabel,
  ctaHref,
}: {
  brand: string;
  links: { label: string; href: string }[];
  ctaLabel: string;
  ctaHref: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="grid h-10 w-10 cursor-pointer place-items-center rounded-site-sm border border-site-border text-site-text"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
        </svg>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`${brand} navigation`}
        >
          <div className="w-full rounded-site-lg border border-site-border bg-site-surface p-6 text-site-text shadow-modal sm:w-96">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="font-heading text-lg font-semibold">{brand}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-site-sm border border-site-border px-2.5 py-1 text-xs font-medium text-site-muted hover:text-site-text"
              >
                Close
              </button>
            </div>
            <nav aria-label="Mobile navigation" className="space-y-1">
              {links.map((link, index) => (
                <a
                  key={index}
                  href={link.href || "#"}
                  onClick={() => setOpen(false)}
                  className="block rounded-site-sm px-3 py-2.5 text-sm font-medium text-site-text hover:bg-site-bg/60"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <a
              href={ctaHref || "#"}
              onClick={() => setOpen(false)}
              className={cn(siteButton({ variant: "solid", size: "md" }), "mt-4 w-full justify-center")}
            >
              {ctaLabel}
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
