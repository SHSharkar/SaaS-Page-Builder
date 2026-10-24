"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  archivePageAction,
  deletePageAction,
  duplicatePageAction,
  publishPageAction,
  rollbackPageAction,
  unpublishPageAction,
} from "@/lib/actions/pages";
import { savePageAsTemplateAction } from "@/lib/actions/templates";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Notice, type ActionResult } from "@/components/admin/action";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

type VersionRow = {
  id: string;
  versionNumber: number;
  note: string;
  publishedAt: string;
  isCurrent: boolean;
  sectionCount: number;
};

export function PageLifecycleBar({
  siteId,
  pageId,
  status,
  canEdit,
  canPublish,
  canDelete,
  canSaveTemplate,
}: {
  siteId: string;
  pageId: string;
  status: string;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
  canSaveTemplate: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplDesc, setTplDesc] = useState("");
  const [confirmTrashOpen, setConfirmTrashOpen] = useState(false);

  const run = (fn: () => Promise<ActionResult>) => {
    startTransition(async () => {
      const res = await fn();
      setState(res);
      if (res.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {canPublish ? (
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "primary" })}
            onClick={() => run(() => publishPageAction({ siteId, pageId }))}
          >
            {status === "published" ? "Publish new version" : "Publish"}
          </button>
        ) : null}
        {canPublish && status === "published" ? (
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "secondary" })}
            onClick={() => run(() => unpublishPageAction({ siteId, pageId }))}
          >
            Unpublish
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "secondary" })}
            onClick={() =>
              startTransition(async () => {
                const res = await duplicatePageAction({ siteId, pageId });
                setState(res);
                if (res.ok && res.pageId) {
                  router.push(`/admin/sites/${siteId}/pages/${res.pageId}`);
                }
              })
            }
          >
            Duplicate
          </button>
        ) : null}
        {canSaveTemplate ? (
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "secondary" })}
            onClick={() => setTemplateOpen((prev) => !prev)}
          >
            Save as template
          </button>
        ) : null}
        {canEdit && status !== "archived" ? (
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "secondary" })}
            onClick={() => run(() => archivePageAction({ siteId, pageId }))}
          >
            Archive
          </button>
        ) : null}
        {canDelete ? (
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "danger" })}
            onClick={() => setConfirmTrashOpen(true)}
          >
            Move to trash
          </button>
        ) : null}
      </div>

      {templateOpen ? (
        <form
          className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-3"
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              const res = await savePageAsTemplateAction({
                siteId,
                pageId,
                name: tplName,
                description: tplDesc,
              });
              if (res.ok) setTemplateOpen(false);
              return res;
            });
          }}
        >
          <div>
            <label className={adminLabelClass} htmlFor="tpl-name">
              Template name
            </label>
            <input
              id="tpl-name"
              className={adminInputClass}
              value={tplName}
              onChange={(event) => setTplName(event.target.value)}
              placeholder="Seasonal Bonus Layout"
              required
            />
          </div>
          <div>
            <label className={adminLabelClass} htmlFor="tpl-desc">
              Short note
            </label>
            <input
              id="tpl-desc"
              className={adminInputClass}
              value={tplDesc}
              onChange={(event) => setTplDesc(event.target.value)}
              placeholder="When editors should pick this"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className={adminButtonVariants({ tone: "primary" })}
              disabled={pending}
            >
              Save to gallery
            </button>
          </div>
        </form>
      ) : null}

      <Notice state={state} />

      <ConfirmModal
        open={confirmTrashOpen}
        title="Move page to trash"
        description="Move this page to the trash? It goes offline immediately and stays restorable for 30 days."
        confirmLabel="Move to trash"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmTrashOpen(false)}
        onConfirm={() => {
          setConfirmTrashOpen(false);
          startTransition(async () => {
            const res = await deletePageAction({ siteId, pageId });
            if (res && !res.ok) setState(res);
          });
        }}
      />
    </div>
  );
}

export function VersionHistoryList({
  siteId,
  pageId,
  versions,
  canRollback,
}: {
  siteId: string;
  pageId: string;
  versions: VersionRow[];
  canRollback: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmRollback, setConfirmRollback] = useState<VersionRow | null>(null);

  if (versions.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        No versions published yet. Publishing snapshots the current draft as version 1.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Notice state={state} />
      <ol className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {versions.map((version) => (
          <li
            key={version.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-slate-950">
                  v{version.versionNumber}
                </span>
                {version.isCurrent ? (
                  <span className={adminBadgeVariants({ tone: "green" })}>live</span>
                ) : null}
                <span className="text-slate-600">{version.note || "Published"}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {new Date(version.publishedAt).toLocaleString("en-US", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                | {version.sectionCount} sections
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/preview/${siteId}/${pageId}?version=${version.id}`}
                target="_blank"
                rel="noreferrer"
                className={adminButtonVariants({ tone: "secondary", size: "sm" })}
              >
                Inspect snapshot
              </a>
              {canRollback && !version.isCurrent ? (
                <button
                  type="button"
                  disabled={pending}
                  className={adminButtonVariants({ tone: "primary", size: "sm" })}
                  onClick={() => setConfirmRollback(version)}
                >
                  Roll back to v{version.versionNumber}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      <ConfirmModal
        open={confirmRollback !== null}
        title="Roll back live page"
        description={
          confirmRollback
            ? `Roll the live page back to v${confirmRollback.versionNumber}? A new version entry will record the rollback.`
            : ""
        }
        confirmLabel={
          confirmRollback ? `Roll back to v${confirmRollback.versionNumber}` : "Roll back"
        }
        tone="primary"
        pending={pending}
        onCancel={() => setConfirmRollback(null)}
        onConfirm={() => {
          if (!confirmRollback) return;
          const targetId = confirmRollback.id;
          setConfirmRollback(null);
          startTransition(async () => {
            const res = await rollbackPageAction({
              siteId,
              pageId,
              versionId: targetId,
            });
            setState(res);
            if (res.ok) router.refresh();
          });
        }}
      />
    </div>
  );
}
