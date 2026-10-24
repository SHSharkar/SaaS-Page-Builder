"use client";

import { useId, useState } from "react";
import { RichText } from "@/lib/registry/shell";
import { cn } from "@/lib/theme-classes";

export type TabItem = {
  label: string;
  heading: string;
  body: string;
};

export function TabsPanel({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(0);
  const baseId = useId();

  if (tabs.length === 0) {
    return null;
  }

  const safeIndex = Math.min(active, tabs.length - 1);
  const current = tabs[safeIndex];

  return (
    <div className="rounded-site-lg border border-site-border bg-site-surface">
      <div
        role="tablist"
        aria-label="Content tabs"
        className="flex flex-wrap gap-1 border-b border-site-border p-2"
      >
        {tabs.map((tab, index) => {
          const selected = index === safeIndex;
          return (
            <button
              key={`${tab.label}-${index}`}
              id={`${baseId}-tab-${index}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${index}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  setActive((index + 1) % tabs.length);
                } else if (event.key === "ArrowLeft") {
                  setActive((index - 1 + tabs.length) % tabs.length);
                } else if (event.key === "Home") {
                  setActive(0);
                } else if (event.key === "End") {
                  setActive(tabs.length - 1);
                }
              }}
              className={cn(
                "cursor-pointer rounded-site-sm px-4 py-2 text-sm font-semibold transition-colors",
                selected
                  ? "bg-site-accent text-site-accent-contrast"
                  : "text-site-muted hover:text-site-text",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div
        id={`${baseId}-panel-${safeIndex}`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${safeIndex}`}
        className="p-6 sm:p-8"
      >
        {current?.heading ? (
          <h3 className="mb-3 font-heading text-xl text-site-text">{current.heading}</h3>
        ) : null}
        <RichText text={current?.body ?? ""} className="text-sm leading-relaxed text-site-muted" />
      </div>
    </div>
  );
}
