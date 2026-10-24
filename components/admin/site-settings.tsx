"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateSiteAction, suspendSiteAction, deleteSiteAction } from "@/lib/actions/sites";
import { FONT_STACKS } from "@/lib/documents";
import type { ActionResult } from "./action";
import { Notice } from "./action";

export type ThemeDraft = {
  accent: string;
  accentContrast: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
  headingFont: string;
  bodyFont: string;
  radius: "sharp" | "soft" | "round";
  logoText: string;
  logoMediaId: string | null;
  tagline: string;
};

const COLOURS: { key: keyof ThemeDraft; label: string; hint: string }[] = [
  { key: "accent", label: "Accent", hint: "Buttons, links, highlights" },
  { key: "accentContrast", label: "On accent", hint: "Text on accent surfaces" },
  { key: "background", label: "Background", hint: "Page canvas" },
  { key: "surface", label: "Surface", hint: "Cards and panels" },
  { key: "text", label: "Text", hint: "Body copy" },
  { key: "muted", label: "Muted text", hint: "Secondary copy" },
  { key: "border", label: "Border", hint: "Dividers and outlines" },
];

export function SiteSettings({
  siteId,
  name,
  slug,
  status,
  theme,
  media,
  canManage,
}: {
  siteId: string;
  name: string;
  slug: string;
  status: string;
  theme: ThemeDraft;
  media: { id: string; alt: string | null }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [siteName, setSiteName] = useState(name);
  const [draft, setDraft] = useState<ThemeDraft>(theme);
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>, redirectTo?: string) =>
    startTransition(async () => {
      const result = await fn();
      setState(result);
      if (result.ok) {
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      }
    });

  return (
    <div className="space-y-5">
      <Notice state={state} />

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Identity</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            The slug is fixed at creation — changing it would break every existing link.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="site-name">
              Site name
            </label>
            <input id="site-name" className="input" value={siteName} onChange={(event) => setSiteName(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="site-slug">
              Slug
            </label>
            <input id="site-slug" className="input bg-paper" value={slug} readOnly />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Brand and theme</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Theme values become CSS variables on every page — components never hard-code colour.
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {COLOURS.map((colour) => (
            <div key={colour.key}>
              <label className="label" htmlFor={`theme-${colour.key}`}>
                {colour.label}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`theme-${colour.key}`}
                  type="color"
                  className="h-9 w-12 cursor-pointer rounded-md border border-line bg-white p-1"
                  value={String(draft[colour.key])}
                  onChange={(event) => setDraft((current) => ({ ...current, [colour.key]: event.target.value }))}
                />
                <input
                  className="input font-mono !text-[12px]"
                  value={String(draft[colour.key])}
                  onChange={(event) => setDraft((current) => ({ ...current, [colour.key]: event.target.value }))}
                />
              </div>
              <p className="mt-1 text-[10px] text-slate-400">{colour.hint}</p>
            </div>
          ))}

          <div>
            <label className="label" htmlFor="theme-heading-font">
              Heading font
            </label>
            <select
              id="theme-heading-font"
              className="select"
              value={draft.headingFont}
              onChange={(event) => setDraft((current) => ({ ...current, headingFont: event.target.value }))}
            >
              {Object.keys(FONT_STACKS).map((key) => (
                <option key={key} value={key}>
                  {key.replace(/-/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="theme-body-font">
              Body font
            </label>
            <select
              id="theme-body-font"
              className="select"
              value={draft.bodyFont}
              onChange={(event) => setDraft((current) => ({ ...current, bodyFont: event.target.value }))}
            >
              {Object.keys(FONT_STACKS).map((key) => (
                <option key={key} value={key}>
                  {key.replace(/-/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="theme-radius">
              Corner radius
            </label>
            <select
              id="theme-radius"
              className="select"
              value={draft.radius}
              onChange={(event) =>
                setDraft((current) => ({ ...current, radius: event.target.value as ThemeDraft["radius"] }))
              }
            >
              <option value="sharp">Sharp</option>
              <option value="soft">Soft</option>
              <option value="round">Round</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="theme-logo-text">
              Wordmark
            </label>
            <input
              id="theme-logo-text"
              className="input"
              value={draft.logoText}
              onChange={(event) => setDraft((current) => ({ ...current, logoText: event.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="theme-tagline">
              Tagline
            </label>
            <input
              id="theme-tagline"
              className="input"
              value={draft.tagline}
              onChange={(event) => setDraft((current) => ({ ...current, tagline: event.target.value }))}
            />
          </div>

          <div>
            <label className="label" htmlFor="theme-logo-media">
              Logo image
            </label>
            <select
              id="theme-logo-media"
              className="select"
              value={draft.logoMediaId ?? ""}
              onChange={(event) => setDraft((current) => ({ ...current, logoMediaId: event.target.value || null }))}
            >
              <option value="">Wordmark only</option>
              {media.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.alt || asset.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-4">
          <button
            type="button"
            className="btn-admin btn-admin-primary"
            disabled={pending}
            onClick={() => run(() => updateSiteAction({ siteId, name: siteName, theme: draft as unknown as Record<string, string> }))}
          >
            {pending ? "Saving…" : "Save appearance"}
          </button>
          <div
            className="flex items-center gap-3 rounded-lg border px-3 py-2 text-[12px]"
            style={{ background: draft.background, borderColor: draft.border, color: draft.text }}
          >
            <span
              className="rounded px-2 py-1 text-[11px] font-semibold"
              style={{ background: draft.accent, color: draft.accentContrast }}
            >
              {draft.logoText || "Wordmark"}
            </span>
            <span style={{ color: draft.muted }}>{draft.tagline || "Tagline"}</span>
          </div>
        </div>
      </section>

      {canManage ? (
        <section className="panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Danger zone</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              These acts need a fresh identity confirmation — the server refuses them without a recent sign-in proof.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 p-5">
            {status === "suspended" ? (
              <button
                type="button"
                className="btn-admin btn-admin-secondary"
                disabled={pending}
                onClick={() => run(() => suspendSiteAction({ siteId, suspend: false }))}
              >
                Resume serving
              </button>
            ) : (
              <button
                type="button"
                className="btn-admin btn-admin-secondary"
                disabled={pending}
                onClick={() => {
                  if (!window.confirm("Suspend this site? Every hostname starts returning the site 404 immediately.")) return;
                  run(() => suspendSiteAction({ siteId, suspend: true }));
                }}
              >
                Suspend site
              </button>
            )}
            <button
              type="button"
              className="btn-admin btn-admin-danger"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Delete this site? It stops serving immediately and is restorable within the retention window.")) return;
                run(() => deleteSiteAction({ siteId }), "/admin/sites");
              }}
            >
              Delete site
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
