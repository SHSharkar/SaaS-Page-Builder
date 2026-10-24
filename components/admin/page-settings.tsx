"use client";

import { useState, useTransition } from "react";
import {
  updatePageMetaAction,
  scheduleAction,
  publishAction,
  unpublishAction,
  archiveAction,
  restoreAction,
  setHomepageAction,
  saveAsTemplateAction,
} from "@/lib/actions/pages";
import type { PageSeo } from "@/lib/documents";
import type { ActionResult } from "./action";
import { Notice } from "./action";

type MediaOption = { id: string; url: string; alt: string | null };

function localInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function PageSettings({
  siteId,
  pageId,
  page,
  seo,
  media,
  status,
  isHomepage,
  scheduledPublishAt,
  scheduledUnpublishAt,
}: {
  siteId: string;
  pageId: string;
  page: { title: string; slug: string; status: string };
  seo: PageSeo;
  media: MediaOption[];
  status: string;
  isHomepage: boolean;
  scheduledPublishAt: string | null;
  scheduledUnpublishAt: string | null;
}) {
  const [title, setTitle] = useState(page.title);
  const [slug, setSlug] = useState(page.slug);
  const [seoState, setSeoState] = useState<PageSeo>(seo);
  const [publishAt, setPublishAt] = useState(localInput(scheduledPublishAt));
  const [unpublishAt, setUnpublishAt] = useState(localInput(scheduledUnpublishAt));
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setState(await fn());
    });

  const field = (key: keyof PageSeo) => ({
    value: (seoState[key] ?? "") as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setSeoState((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <div className="space-y-5">
      <Notice state={state} />

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Address and title</h2>
          <p className="mt-0.5 text-xs text-slate-500">Changing the URL retires the old one immediately.</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="page-title">
              Title
            </label>
            <input id="page-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="page-slug">
              URL path
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400">/</span>
              <input id="page-slug" className="input" value={slug} onChange={(event) => setSlug(event.target.value)} />
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Search and sharing</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Every page carries its own tags; the site defaults fill in whatever is left blank.
          </p>
        </div>
        <div className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="seo-title">
                SEO title
              </label>
              <input id="seo-title" className="input" maxLength={70} {...field("title")} placeholder={`${title}`} />
              <p className="mt-1 text-[11px] text-slate-400">{(seoState.title ?? "").length}/70 characters.</p>
            </div>
            <div>
              <label className="label" htmlFor="seo-canonical">
                Canonical
              </label>
              <select id="seo-canonical" className="select" {...field("canonicalMode")}>
                <option value="self">Point at this page</option>
                <option value="none">No canonical tag</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>
          </div>

          {seoState.canonicalMode === "custom" ? (
            <div>
              <label className="label" htmlFor="seo-canonical-url">
                Canonical URL
              </label>
              <input id="seo-canonical-url" className="input" {...field("canonicalUrl")} placeholder="https://example.com/page" />
            </div>
          ) : null}

          <div>
            <label className="label" htmlFor="seo-description">
              Meta description
            </label>
            <textarea
              id="seo-description"
              className="textarea"
              maxLength={180}
              {...field("description")}
              placeholder="One or two sentences a search result can show."
            />
            <p className="mt-1 text-[11px] text-slate-400">{(seoState.description ?? "").length}/180 characters.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="seo-og-title">
                Share title
              </label>
              <input id="seo-og-title" className="input" {...field("ogTitle")} placeholder="Defaults to the SEO title" />
            </div>
            <div>
              <label className="label" htmlFor="seo-og-description">
                Share description
              </label>
              <input id="seo-og-description" className="input" {...field("ogDescription")} placeholder="Defaults to the meta description" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="seo-share-image">
                Share image
              </label>
              <select id="seo-share-image" className="select" {...field("shareImageId")}>
                <option value="">No share image</option>
                {media.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.alt || asset.url}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="seo-keywords">
                Keywords
              </label>
              <input id="seo-keywords" className="input" {...field("keywords")} placeholder="rewards, trophies, casino" />
            </div>
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-line bg-paper/60 px-3.5 py-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={seoState.noindex}
              onChange={(event) => setSeoState((current) => ({ ...current, noindex: event.target.checked }))}
            />
            <span>
              <span className="block text-[13px] font-medium text-ink-900">Hide from search engines</span>
              <span className="block text-[11px] text-slate-500">
                Adds noindex to the page and drops it from the sitemap.
              </span>
            </span>
          </label>

          <button
            type="button"
            className="btn-admin btn-admin-primary"
            disabled={pending}
            onClick={() =>
              submit(() =>
                updatePageMetaAction({
                  siteId,
                  pageId,
                  title,
                  slug,
                  seo: seoState,
                }),
              )
            }
          >
            {pending ? "Saving…" : "Save page settings"}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Scheduling</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Queued jobs run on the worker; publish time uses the staff member&apos;s local clock.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="schedule-publish">
              Publish at
            </label>
            <div className="flex gap-2">
              <input
                id="schedule-publish"
                type="datetime-local"
                className="input"
                value={publishAt}
                onChange={(event) => setPublishAt(event.target.value)}
              />
              <button
                type="button"
                className="btn-admin btn-admin-secondary !px-3 !text-xs"
                disabled={pending}
                onClick={() =>
                  submit(() =>
                    scheduleAction({ siteId, pageId, when: publishAt ? new Date(publishAt).toISOString() : null, operator: "publish" }),
                  )
                }
              >
                Set
              </button>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="schedule-unpublish">
              Unpublish at
            </label>
            <div className="flex gap-2">
              <input
                id="schedule-unpublish"
                type="datetime-local"
                className="input"
                value={unpublishAt}
                onChange={(event) => setUnpublishAt(event.target.value)}
              />
              <button
                type="button"
                className="btn-admin btn-admin-secondary !px-3 !text-xs"
                disabled={pending}
                onClick={() =>
                  submit(() =>
                    scheduleAction({
                      siteId,
                      pageId,
                      when: unpublishAt ? new Date(unpublishAt).toISOString() : null,
                      operator: "unpublish",
                    }),
                  )
                }
              >
                Set
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Publishing actions</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Publish takes the current draft live. Unpublish and archive both free the URL immediately.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-5">
          <button
            type="button"
            className="btn-admin btn-admin-accent"
            disabled={pending}
            onClick={() => submit(() => publishAction({ siteId, pageId }))}
          >
            Publish now
          </button>
          <button
            type="button"
            className="btn-admin btn-admin-secondary"
            disabled={pending || status !== "published"}
            onClick={() =>
              submit(() => unpublishAction({ siteId, pageId }))
            }
            title={status !== "published" ? "Only a published page can be taken offline" : undefined}
          >
            Unpublish
          </button>
          <button
            type="button"
            className="btn-admin btn-admin-secondary"
            disabled={pending || isHomepage}
            onClick={() => submit(() => setHomepageAction({ siteId, pageId }))}
            title={isHomepage ? "Already the homepage" : "Make this the site homepage"}
          >
            {isHomepage ? "Homepage" : "Make homepage"}
          </button>
          {status === "archived" ? (
            <button
              type="button"
              className="btn-admin btn-admin-secondary"
              disabled={pending}
              onClick={() => submit(() => restoreAction({ siteId, pageId }))}
            >
              Restore from archive
            </button>
          ) : (
            <button
              type="button"
              className="btn-admin btn-admin-danger"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Archive this page? Its URL starts returning the site 404 immediately.")) return;
                submit(() => archiveAction({ siteId, pageId }));
              }}
            >
              Archive
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Save as template</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Tokens written as <code className="font-mono text-[11px]">{"{{token}}"}</code> become fill-in fields.
          </p>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="template-name">
              Template name
            </label>
            <input
              id="template-name"
              className="input"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Campaign landing page"
            />
          </div>
          <div>
            <label className="label" htmlFor="template-description">
              Description
            </label>
            <input
              id="template-description"
              className="input"
              value={templateDescription}
              onChange={(event) => setTemplateDescription(event.target.value)}
              placeholder="Hero, bonus grid, terms"
            />
          </div>
          <button
            type="button"
            className="btn-admin btn-admin-secondary"
            disabled={pending || templateName.trim().length < 2}
            onClick={() =>
              submit(() =>
                saveAsTemplateAction({ siteId, pageId, name: templateName, description: templateDescription }),
              )
            }
          >
            Save template
          </button>
        </div>
      </section>
    </div>
  );
}
