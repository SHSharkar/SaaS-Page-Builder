"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import type { PageDocument, SiteTheme } from "@/lib/documents";
import { DOCUMENT_SCHEMA_VERSION, DEFAULT_ROOT_PROPS } from "@/lib/documents";
import type { ResolvedMedia } from "@/lib/media/refs";
import { primeMedia } from "@/lib/media/refs";
import { buildPuckConfig } from "./puck-config";
import {
  publishAction,
  publishGlobalsAction,
  saveDraftAction,
  saveGlobalsDraftAction,
} from "@/lib/actions/pages";

export type EditorScope = "page" | "navigation" | "footer" | "defaults";

type Props = {
  siteId: string;
  siteName: string;
  pageId: string;
  title: string;
  slug: string;
  status: string;
  lockVersion: number;
  document: PageDocument;
  theme: SiteTheme;
  media: ResolvedMedia[];
  scope: EditorScope;
  previewHref: string | null;
  historyHref?: string;
  canPublish: boolean;
  publishedAt?: string | null;
};

function toDocument(data: Partial<Data>): PageDocument {
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: { ...DEFAULT_ROOT_PROPS, ...(data.root?.props as object) } },
    content: (data.content ?? []).map((node) => ({
      type: node.type,
      props: node.props as PageDocument["content"][number]["props"],
    })),
  };
}

export function PageEditor(props: Props) {
  const router = useRouter();
  const [media, setMedia] = useState<ResolvedMedia[]>(props.media);
  const [lockVersion, setLockVersion] = useState(props.lockVersion);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "publish">(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const latest = useRef<Partial<Data>>(props.document as unknown as Partial<Data>);

  useEffect(() => {
    primeMedia(media);
  }, [media]);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const onUploaded = useCallback((asset: ResolvedMedia) => {
    setMedia((current) => [...current.filter((item) => item.id !== asset.id), asset]);
  }, []);

  const config = useMemo(
    () =>
      buildPuckConfig({
        siteId: props.siteId,
        theme: props.theme,
        media,
        onUploaded,
        scope: props.scope === "page" ? "page" : "site-frame",
      }),
    [props.siteId, props.theme, props.scope, media, onUploaded],
  );

  const save = useCallback(
    async (data: Partial<Data>): Promise<boolean> => {
      setBusy("save");
      setNotice(null);
      const document = toDocument(data);
      const result =
        props.scope === "page"
          ? await saveDraftAction({ siteId: props.siteId, pageId: props.pageId, document, lockVersion })
          : await saveGlobalsDraftAction({ siteId: props.siteId, kind: props.scope, document, lockVersion });

      setBusy(null);
      if (!result.ok) {
        setNotice({ tone: "error", text: result.error ?? "Could not save." });
        return false;
      }
      if (result.lockVersion !== undefined) setLockVersion(result.lockVersion);
      setDirty(false);
      setNotice({ tone: "ok", text: result.message ?? "Saved" });
      return true;
    },
    [lockVersion, props.pageId, props.scope, props.siteId],
  );

  const publish = useCallback(async () => {
    if (dirty) {
      const saved = await save(latest.current);
      if (!saved) return;
    }
    setBusy("publish");
    setNotice(null);
    const result =
      props.scope === "page"
        ? await publishAction({ siteId: props.siteId, pageId: props.pageId })
        : await publishGlobalsAction({ siteId: props.siteId, kind: props.scope });
    setBusy(null);
    if (!result.ok) {
      setNotice({ tone: "error", text: result.error ?? "Could not publish." });
      return;
    }
    setNotice({ tone: "ok", text: result.message ?? "Published" });
    router.refresh();
  }, [dirty, props.pageId, props.scope, props.siteId, router, save]);

  const statusLabel =
    props.scope === "page"
      ? props.status === "published"
        ? "Published"
        : props.status === "archived"
          ? "Archived"
          : "Draft"
      : props.publishedAt
        ? "Published"
        : "Draft";

  return (
    <div className="flex h-screen flex-col bg-paper">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-2.5">
        <Link
          href={`/admin/sites/${props.siteId}${props.scope === "page" ? "/pages" : "/globals"}`}
          className="flex items-center gap-1.5 text-[12px] font-medium text-slate-500 hover:text-ink-900"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M11 5 4 12l7 7 1.4-1.4L7.8 13H20v-2H7.8l4.6-5.6z" />
          </svg>
          {props.siteName}
        </Link>
        <span className="text-slate-300">/</span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink-900">{props.title}</p>
          <p className="truncate font-mono text-[10px] text-slate-400">
            {props.scope === "page" ? `/${props.slug}` : `site ${props.scope}`}
          </p>
        </div>
        <span
          className={`badge ${
            statusLabel === "Published" ? "badge-green" : statusLabel === "Archived" ? "badge-gray" : "badge-amber"
          }`}
        >
          {statusLabel}
        </span>
        {dirty ? <span className="badge badge-blue">Unsaved changes</span> : null}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {notice ? (
            <span
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                notice.tone === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
              role="status"
            >
              {notice.text}
            </span>
          ) : null}
          {props.historyHref ? (
            <Link href={props.historyHref} className="btn-admin btn-admin-secondary !py-1.5 !text-[12px]">
              History
            </Link>
          ) : null}
          {props.previewHref ? (
            <a
              href={props.previewHref}
              target="_blank"
              rel="noreferrer"
              className="btn-admin btn-admin-secondary !py-1.5 !text-[12px]"
            >
              Preview
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void save(latest.current)}
            className="btn-admin btn-admin-secondary !py-1.5 !text-[12px]"
            disabled={busy !== null}
          >
            {busy === "save" ? "Saving…" : "Save draft"}
          </button>
          {props.canPublish ? (
            <button
              type="button"
              onClick={() => void publish()}
              className="btn-admin btn-admin-accent !py-1.5 !text-[12px]"
              disabled={busy !== null}
            >
              {busy === "publish" ? "Publishing…" : props.scope === "page" ? "Publish" : "Publish to site"}
            </button>
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1">
        <Puck
          config={config}
          data={props.document as unknown as Partial<Data>}
          height="100%"
          iframe={{ enabled: false }}
          onChange={(data) => {
            latest.current = data as unknown as Partial<Data>;
            setDirty(true);
          }}
          onPublish={(data) => {
            latest.current = data as unknown as Partial<Data>;
            void save(data as unknown as Partial<Data>);
          }}
          headerTitle={props.title}
          headerPath={props.scope === "page" ? `/${props.slug}` : props.scope}
          dictionary={{ "header-publish": "Save draft" }}
        />
      </div>
    </div>
  );
}
