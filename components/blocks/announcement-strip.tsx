"use client";

import { useState } from "react";
import { cn } from "@/lib/theme-classes";

export function AnnouncementStrip({
  message,
  linkLabel,
  linkHref,
  tone,
  dismissible,
}: {
  message: string;
  linkLabel?: string;
  linkHref?: string;
  tone: "accent" | "dark" | "surface";
  dismissible: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const toneClass =
    tone === "accent"
      ? "bg-site-accent text-site-accent-contrast"
      : tone === "dark"
        ? "bg-ink-950 text-slate-100"
        : "border-b border-site-border bg-site-surface text-site-text";

  return (
    <div
      data-block-section=""
      className={cn("flex items-center justify-center gap-3 px-4 py-2 text-xs font-medium", toneClass)}
    >
      <p className="text-center">
        <span>{message}</span>
        {linkLabel ? (
          <a href={linkHref || "#"} className="ml-2 font-semibold underline underline-offset-2">
            {linkLabel}
          </a>
        ) : null}
      </p>
      {dismissible ? (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss announcement"
          className="cursor-pointer rounded px-1.5 py-0.5 text-xs opacity-75 hover:opacity-100"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
