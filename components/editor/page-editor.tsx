"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { buildEditorConfig, type MediaOption } from "./puck-config";
import type { DocumentMeta, SiteTheme } from "@/lib/documents";
import {
  publishPageAction,
  saveDraftAction,
  saveGlobalAction,
  schedulePublishAction,
} from "@/lib/actions/pages";
import { fromPuckData } from "@/lib/puck-data";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

type Mode =
  | {
      kind: "page";
      pageId: string;
      slug: string;
      status: string;
      publishedVersionNumber: number | null;
      scheduledPublishAt: string | null;
    }
  | {
      kind: "global";
      globalKind: "navigation" | "footer" | "defaults";
      label: string;
    };

export function PageEditor({
  siteId,
  siteName,
  mode,
  initialTitle,
  initialMeta,
  initialData,
  initialLockVersion,
  theme,
  media,
  canEdit,
  canPublish,
  allowAdminBlocks,
  previewUrl,
}: {
  siteId: string;
  siteName: string;
  mode: Mode;
  initialTitle: string;
  initialMeta: DocumentMeta;
  initialData: Data;
  initialLockVersion: number;
  theme: SiteTheme;
  media: MediaOption[];
  canEdit: boolean;
  canPublish: boolean;
  allowAdminBlocks: boolean;
  previewUrl: string;
}) {
  const router = useRouter();
  const dataRef = useRef<Data>(initialData);
  const [lockVersion, setLockVersion] = useState<number>(initialLockVersion);
  const [title, setTitle] = useState<string>(initialTitle);
  const [slug, setSlug] = useState<string>(mode.kind === "page" ? mode.slug : "");
  const [meta, setMeta] = useState<DocumentMeta>(initialMeta);
  const [mediaList, setMediaList] = useState<MediaOption[]>(media);
  const [metaOpen, setMetaOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishNote, setPublishNote] = useState("");
  const [scheduleAt, setScheduleAt] = useState(
    mode.kind === "page" && mode.scheduledPublishAt
      ? mode.scheduledPublishAt.slice(0, 16)
      : "",
  );
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "error" | "conflict";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  const config = useMemo(
    () =>
      buildEditorConfig({
        theme,
        siteId,
        media: mediaList,
        allowAdminBlocks,
        onUploaded: (created) => setMediaList((prev) => [created, ...prev]),
      }),
    [theme, siteId, mediaList, allowAdminBlocks],
  );

  const persistDraft = async (): Promise<number | null> => {
    const document = fromPuckData(dataRef.current);
    if (mode.kind === "global") {
      const res = await saveGlobalAction({
        siteId,
        kind: mode.globalKind,
        document,
        lockVersion,
      });
      if (!res.ok) {
        setFeedback({
          tone: res.conflict ? "conflict" : "error",
          text: res.error ?? "Could not save.",
        });
        return null;
      }
      const next = res.lockVersion ?? lockVersion + 1;
      setLockVersion(next);
      setDirty(false);
      setFeedback({ tone: "ok", text: res.message ?? "Saved." });
      return next;
    }

    const res = await saveDraftAction({
      siteId,
      pageId: mode.pageId,
      title,
      seo: meta,
      document,
      lockVersion,
    });
    if (!res.ok) {
      setFeedback({
        tone: res.conflict ? "conflict" : "error",
        text: res.error ?? "Could not save draft.",
      });
      return null;
    }
    const next = res.lockVersion ?? lockVersion + 1;
    setLockVersion(next);
    setDirty(false);
    setFeedback({ tone: "ok", text: "Draft saved." });
    return next;
  };

  const backHref =
    mode.kind === "page"
      ? `/admin/sites/${siteId}/pages/${mode.pageId}`
      : `/admin/sites/${siteId}/globals`;

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={backHref}
            className="rounded-lg border border-slate-200 px-2.5 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
          >
            Back
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-950">{siteName}</span>
              <span className="text-slate-300">/</span>
              <span className="font-medium text-slate-700">
                {mode.kind === "page" ? title : mode.label}
              </span>
              {mode.kind === "page" ? (
                <span
                  className={adminBadgeVariants({
                    tone: mode.status === "published" ? "green" : "amber",
                  })}
                >
                  {mode.status}
                  {mode.publishedVersionNumber ? ` v${mode.publishedVersionNumber}` : ""}
                </span>
              ) : (
                <span className={adminBadgeVariants({ tone: "blue" })}>site-wide</span>
              )}
              {dirty ? <span className="text-[11px] text-amber-700">unsaved edits</span> : null}
            </div>
            {feedback ? (
              <p
                className={`mt-0.5 text-[11px] ${
                  feedback.tone === "ok" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {feedback.text}{" "}
                {feedback.tone === "conflict" ? (
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => router.refresh()}
                  >
                    Reload latest draft
                  </button>
                ) : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {mode.kind === "page" ? (
            <button
              type="button"
              className={adminButtonVariants({ tone: "secondary", size: "sm" })}
              onClick={() => setMetaOpen((prev) => !prev)}
            >
              SEO & page settings
            </button>
          ) : null}
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className={adminButtonVariants({ tone: "secondary", size: "sm" })}
          >
            Preview
          </a>
          {canEdit ? (
            <button
              type="button"
              disabled={pending}
              className={adminButtonVariants({
                tone: mode.kind === "global" ? "primary" : "secondary",
                size: "sm",
              })}
              onClick={() =>
                startTransition(async () => {
                  await persistDraft();
                })
              }
            >
              {pending ? "Saving..." : mode.kind === "global" ? "Save & apply" : "Save draft"}
            </button>
          ) : null}
          {mode.kind === "page" && canPublish ? (
            <button
              type="button"
              disabled={pending}
              className={adminButtonVariants({ tone: "primary", size: "sm" })}
              onClick={() => setPublishOpen((prev) => !prev)}
            >
              Publish...
            </button>
          ) : null}
        </div>
      </header>

      {mode.kind === "page" && metaOpen ? (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-4 text-xs">
          <div className="mx-auto grid w-full gap-3 sm:grid-cols-3">
            <div>
              <label className={adminLabelClass} htmlFor="ed-title">
                Page title
              </label>
              <input
                id="ed-title"
                className={adminInputClass}
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <label className={adminLabelClass} htmlFor="ed-slug">
                URL slug (empty = homepage)
              </label>
              <input
                id="ed-slug"
                className={`${adminInputClass} font-mono`}
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setDirty(true);
                }}
              />
            </div>
            <div>
              <label className={adminLabelClass} htmlFor="ed-canonical">
                Canonical URL override
              </label>
              <input
                id="ed-canonical"
                className={adminInputClass}
                value={meta.canonicalUrl ?? ""}
                onChange={(event) => {
                  setMeta({ ...meta, canonicalUrl: event.target.value });
                  setDirty(true);
                }}
                placeholder="https://brand.example/offer"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={adminLabelClass} htmlFor="ed-desc">
                Meta description
              </label>
              <input
                id="ed-desc"
                className={adminInputClass}
                value={meta.description ?? ""}
                onChange={(event) => {
                  setMeta({ ...meta, description: event.target.value });
                  setDirty(true);
                }}
                placeholder="Shown in search results and link previews."
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  className="accent-slate-950"
                  checked={Boolean(meta.noindex)}
                  onChange={(event) => {
                    setMeta({ ...meta, noindex: event.target.checked });
                    setDirty(true);
                  }}
                />
                Hide from search engines (noindex)
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {mode.kind === "page" && publishOpen ? (
        <div className="border-b border-slate-200 bg-amber-50/70 px-6 py-4 text-xs">
          <div className="mx-auto flex w-full flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1">
              <label className={adminLabelClass} htmlFor="pub-note">
                Version note (recorded in history)
              </label>
              <input
                id="pub-note"
                className={adminInputClass}
                value={publishNote}
                onChange={(event) => setPublishNote(event.target.value)}
                placeholder="Updated welcome bonus cap and wagering copy"
              />
            </div>
            <button
              type="button"
              disabled={pending}
              className={adminButtonVariants({ tone: "primary" })}
              onClick={() =>
                startTransition(async () => {
                  const saved = await persistDraft();
                  if (saved === null) return;
                  const res = await publishPageAction({
                    siteId,
                    pageId: mode.pageId,
                    note: publishNote,
                  });
                  if (!res.ok) {
                    setFeedback({ tone: "error", text: res.error ?? "Publish failed." });
                    return;
                  }
                  setPublishOpen(false);
                  setPublishNote("");
                  setFeedback({ tone: "ok", text: res.message ?? "Published." });
                  router.refresh();
                })
              }
            >
              {pending ? "Publishing..." : "Save & publish now"}
            </button>
            <div className="flex flex-wrap items-end gap-2 border-l border-amber-200 pl-3">
              <div>
                <label className={adminLabelClass} htmlFor="sched-at">
                  Or schedule for
                </label>
                <input
                  id="sched-at"
                  type="datetime-local"
                  className={adminInputClass}
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
              </div>
              <button
                type="button"
                disabled={pending}
                className={adminButtonVariants({ tone: "secondary" })}
                onClick={() =>
                  startTransition(async () => {
                    const saved = await persistDraft();
                    if (saved === null) return;
                    const iso = scheduleAt ? new Date(scheduleAt).toISOString() : null;
                    const res = await schedulePublishAction({
                      siteId,
                      pageId: mode.pageId,
                      publishAt: iso,
                    });
                    setFeedback({
                      tone: res.ok ? "ok" : "error",
                      text: res.error ?? res.message ?? "",
                    });
                    if (res.ok) router.refresh();
                  })
                }
              >
                {scheduleAt ? "Schedule" : "Clear schedule"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-1">
        <Puck
          config={config}
          data={initialData}
          headerPath={previewUrl}
          overrides={{
            header: () => <></>,
          }}
          onChange={(nextData) => {
            dataRef.current = nextData;
            setDirty(true);
          }}
        />
      </div>
    </div>
  );
}
