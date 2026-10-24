"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purgePageAction, restorePageAction } from "@/lib/actions/pages";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Notice, type ActionResult } from "@/components/admin/action";
import { adminBadgeVariants, adminButtonVariants } from "@/lib/theme-classes";

type TrashedRow = {
  id: string;
  title: string;
  slug: string;
  trashedAt: string | null;
  purgeAfter: string | null;
  daysLeft: number;
};

export function TrashedPagesPanel({
  siteId,
  pages,
  canEdit,
  canDelete,
}: {
  siteId: string;
  pages: TrashedRow[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmPurge, setConfirmPurge] = useState<TrashedRow | null>(null);

  if (pages.length === 0) return null;

  return (
    <div className="space-y-3">
      <Notice state={state} />
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {pages.map((page) => (
          <div
            key={page.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{page.title}</span>
                <span className="font-mono text-slate-400">
                  {page.slug ? `/${page.slug}` : "/"}
                </span>
                <span
                  className={adminBadgeVariants({
                    tone: page.daysLeft <= 5 ? "red" : "amber",
                  })}
                >
                  {page.daysLeft === 0
                    ? "purges on next sweep"
                    : `${page.daysLeft}d left in trash`}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Moved to trash{" "}
                {page.trashedAt
                  ? new Date(page.trashedAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "recently"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit ? (
                <button
                  type="button"
                  disabled={pending}
                  className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await restorePageAction({ siteId, pageId: page.id });
                      setState(res);
                      if (res.ok) router.refresh();
                    })
                  }
                >
                  Restore as draft
                </button>
              ) : null}
              {canDelete ? (
                <button
                  type="button"
                  disabled={pending}
                  className={adminButtonVariants({ tone: "danger", size: "sm" })}
                  onClick={() => setConfirmPurge(page)}
                >
                  Delete forever
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={confirmPurge !== null}
        title="Delete page forever"
        description={
          confirmPurge
            ? `Permanently delete "${confirmPurge.title}" and every stored version? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete forever"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmPurge(null)}
        onConfirm={() => {
          if (!confirmPurge) return;
          const targetId = confirmPurge.id;
          setConfirmPurge(null);
          startTransition(async () => {
            const res = await purgePageAction({ siteId, pageId: targetId });
            setState(res);
            if (res.ok) router.refresh();
          });
        }}
      />
    </div>
  );
}
