"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDefaultSeoAction } from "@/lib/actions/pages";
import type { ActionResult } from "./action";
import { Notice } from "./action";

export type DefaultSeoDraft = {
  titleSuffix: string;
  description: string;
  ogDescription: string;
  keywords: string;
  noindex: boolean;
};

export function DefaultSeoForm({
  siteId,
  initial,
  siteName,
  tagline,
}: {
  siteId: string;
  initial: DefaultSeoDraft;
  siteName: string;
  tagline: string;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DefaultSeoDraft>(initial);
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Fallbacks</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Used whenever a page leaves the matching field blank. The page always wins.
            </p>
          </div>
          <div className="space-y-3 p-5">
            <div>
              <label className="label" htmlFor="seo-suffix">
                Title suffix
              </label>
              <input
                id="seo-suffix"
                className="input"
                value={draft.titleSuffix}
                onChange={(event) => setDraft((current) => ({ ...current, titleSuffix: event.target.value }))}
                placeholder={`· ${siteName}`}
              />
              <p className="mt-1 text-[11px] text-slate-400">Shown in the search result title when a page has no SEO title.</p>
            </div>
            <div>
              <label className="label" htmlFor="seo-default-description">
                Description
              </label>
              <textarea
                id="seo-default-description"
                className="textarea"
                maxLength={180}
                value={draft.description}
                onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
                placeholder={tagline}
              />
            </div>
            <div>
              <label className="label" htmlFor="seo-default-og">
                Share description
              </label>
              <input
                id="seo-default-og"
                className="input"
                value={draft.ogDescription}
                onChange={(event) => setDraft((current) => ({ ...current, ogDescription: event.target.value }))}
              />
            </div>
            <div>
              <label className="label" htmlFor="seo-default-keywords">
                Keywords
              </label>
              <input
                id="seo-default-keywords"
                className="input"
                value={draft.keywords}
                onChange={(event) => setDraft((current) => ({ ...current, keywords: event.target.value }))}
                placeholder="rewards, trophies, casino offers"
              />
            </div>
            <label className="flex items-start gap-2.5 rounded-lg border border-line bg-paper/60 px-3.5 py-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.noindex}
                onChange={(event) => setDraft((current) => ({ ...current, noindex: event.target.checked }))}
              />
              <span>
                <span className="block text-[13px] font-medium text-ink-900">Noindex the whole site</span>
                <span className="block text-[11px] text-slate-500">
                  Adds noindex to every page that does not override it. Use while a launch is not ready.
                </span>
              </span>
            </label>
          </div>
        </section>

        <section className="panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Preview</h2>
            <p className="mt-0.5 text-xs text-slate-500">How a page without its own tags would appear.</p>
          </div>
          <div className="space-y-2 p-5">
            <p className="text-[11px] text-slate-400">example.com › page</p>
            <p className="text-[16px] leading-snug text-blue-800">
              Current page title {draft.titleSuffix || `· ${siteName}`}
            </p>
            <p className="text-[12px] leading-relaxed text-slate-600">
              {draft.description || tagline || "No description set — search engines will invent one."}
            </p>
            {draft.noindex ? (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                Search engines are blocked site-wide.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-admin btn-admin-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await saveDefaultSeoAction({
                siteId,
                seo: {
                  description: draft.description || undefined,
                  ogDescription: draft.ogDescription || undefined,
                  keywords: draft.keywords || undefined,
                  noindex: draft.noindex,
                  canonicalMode: "self",
                },
              });
              setState(result);
              router.refresh();
            })
          }
        >
          {pending ? "Publishing…" : "Publish default tags"}
        </button>
        <p className="text-[11px] text-slate-500">Publishing clears every page cache for this site.</p>
      </div>

      <Notice state={state} />
    </div>
  );
}
