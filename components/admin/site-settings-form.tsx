"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteSiteAction,
  suspendSiteAction,
  updateSiteAction,
} from "@/lib/actions/sites";
import type { SiteTheme } from "@/lib/documents";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Notice, type ActionResult } from "@/components/admin/action";
import {
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
  adminSelectClass,
} from "@/lib/theme-classes";

const PALETTES: {
  key: SiteTheme["palette"];
  label: string;
  swatchClass: string;
}[] = [
  {
    key: "obsidian-gold",
    label: "Obsidian & gold",
    swatchClass: "bg-zinc-950 text-amber-400 border-amber-400/40",
  },
  {
    key: "emerald-casino",
    label: "Emerald & mint",
    swatchClass: "bg-emerald-950 text-emerald-300 border-emerald-400/40",
  },
  {
    key: "midnight-neon",
    label: "Midnight & violet",
    swatchClass: "bg-slate-950 text-violet-300 border-violet-400/40",
  },
  {
    key: "ivory-editorial",
    label: "Ivory editorial",
    swatchClass: "bg-stone-50 text-amber-800 border-stone-300",
  },
];

export function SiteSettingsForm({
  siteId,
  initialName,
  initialTheme,
  status,
  canEdit,
  canSuspend,
  canDelete,
}: {
  siteId: string;
  initialName: string;
  initialTheme: SiteTheme;
  status: string;
  canEdit: boolean;
  canSuspend: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [theme, setTheme] = useState<SiteTheme>(initialTheme);
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  return (
    <div className="space-y-6">
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const res = await updateSiteAction({ siteId, name, theme });
            setState(res);
            if (res.ok) router.refresh();
          });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={adminLabelClass} htmlFor="site-name">
              Site name
            </label>
            <input
              id="site-name"
              className={adminInputClass}
              value={name}
              disabled={!canEdit}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <label className={adminLabelClass} htmlFor="logo-text">
              Header wordmark
            </label>
            <input
              id="logo-text"
              className={adminInputClass}
              value={theme.logoText}
              disabled={!canEdit}
              onChange={(event) => setTheme({ ...theme, logoText: event.target.value })}
            />
          </div>
        </div>

        <div>
          <label className={adminLabelClass} htmlFor="tagline">
            Brand tagline
          </label>
          <input
            id="tagline"
            className={adminInputClass}
            value={theme.tagline}
            disabled={!canEdit}
            onChange={(event) => setTheme({ ...theme, tagline: event.target.value })}
          />
        </div>

        <div>
          <p className={adminLabelClass}>Palette preset</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PALETTES.map((preset) => (
              <button
                key={preset.key}
                type="button"
                disabled={!canEdit}
                onClick={() => setTheme({ ...theme, palette: preset.key })}
                className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition ${
                  theme.palette === preset.key
                    ? "border-slate-950 ring-2 ring-slate-950/10"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span
                  className={`grid h-6 w-6 place-items-center rounded-md border text-[11px] font-bold ${preset.swatchClass}`}
                >
                  Aa
                </span>
                <span className="font-medium text-slate-800">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={adminLabelClass} htmlFor="font-pair">
              Typography pairing
            </label>
            <select
              id="font-pair"
              className={adminSelectClass}
              disabled={!canEdit}
              value={theme.fontPair}
              onChange={(event) =>
                setTheme({
                  ...theme,
                  fontPair: event.target.value as SiteTheme["fontPair"],
                })
              }
            >
              <option value="editorial">Editorial serif + sans</option>
              <option value="geometric">Geometric sans</option>
              <option value="classic">Classic serif</option>
            </select>
          </div>
          <div>
            <label className={adminLabelClass} htmlFor="radius">
              Corner radius
            </label>
            <select
              id="radius"
              className={adminSelectClass}
              disabled={!canEdit}
              value={theme.radius}
              onChange={(event) =>
                setTheme({
                  ...theme,
                  radius: event.target.value as SiteTheme["radius"],
                })
              }
            >
              <option value="sharp">Sharp</option>
              <option value="rounded">Rounded</option>
              <option value="pill">Pill</option>
            </select>
          </div>
          <div>
            <label className={adminLabelClass} htmlFor="logo-media-id">
              Logo media ID (optional)
            </label>
            <input
              id="logo-media-id"
              className={adminInputClass}
              disabled={!canEdit}
              placeholder="Paste media ID from library"
              value={theme.logoMediaId ?? ""}
              onChange={(event) =>
                setTheme({
                  ...theme,
                  logoMediaId: event.target.value.trim() || null,
                })
              }
            />
          </div>
        </div>

        {canEdit ? (
          <button
            type="submit"
            className={adminButtonVariants({ tone: "primary" })}
            disabled={pending}
          >
            {pending ? "Saving..." : "Save appearance"}
          </button>
        ) : null}
      </form>

      <Notice state={state} />

      {canSuspend ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-950">
                {status === "suspended" ? "Site is suspended" : "Pause public serving"}
              </p>
              <p className="mt-0.5 text-xs text-amber-900/80">
                {status === "suspended"
                  ? "Public visitors receive 404 and the TLS check refuses new certificates until resumed."
                  : "Suspending takes every page offline immediately without losing drafts or versions."}
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              className={adminButtonVariants({
                tone: status === "suspended" ? "primary" : "secondary",
              })}
              onClick={() =>
                startTransition(async () => {
                  const res = await suspendSiteAction({
                    siteId,
                    suspend: status !== "suspended",
                  });
                  setState(res);
                  if (res.ok) router.refresh();
                })
              }
            >
              {status === "suspended" ? "Resume serving" : "Suspend site"}
            </button>
          </div>
        </div>
      ) : null}

      {canDelete ? (
        <div className="rounded-xl border border-red-200 bg-red-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-950">Delete this site</p>
              <p className="mt-0.5 text-xs text-red-900/80">
                Takes every hostname offline immediately and moves the site into the 30-day
                recovery window before automatic purge.
              </p>
            </div>
            <button
              type="button"
              disabled={pending}
              className={adminButtonVariants({ tone: "danger" })}
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete site
            </button>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmDeleteOpen}
        title="Delete site"
        description={`Delete "${name}"? Every hostname goes offline immediately. An administrator can restore it within 30 days.`}
        confirmLabel="Delete site"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          setConfirmDeleteOpen(false);
          startTransition(async () => {
            const res = await deleteSiteAction({ siteId });
            if (res && !res.ok) setState(res);
          });
        }}
      />
    </div>
  );
}
