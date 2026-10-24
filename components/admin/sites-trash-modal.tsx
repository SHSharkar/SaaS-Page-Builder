"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purgeSiteAction, restoreSiteAction } from "@/lib/actions/sites";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Notice, type ActionResult } from "@/components/admin/action";
import { adminBadgeVariants, adminButtonVariants } from "@/lib/theme-classes";

type DeletedRow = {
  id: string;
  name: string;
  slug: string;
  deletedAt: string | null;
  purgeAfter: string | null;
  daysLeft: number;
};

export function DeletedSitesPanel({
  deleted,
  canRestore,
  canPurge,
}: {
  deleted: DeletedRow[];
  canRestore: boolean;
  canPurge: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmPurge, setConfirmPurge] = useState<DeletedRow | null>(null);

  if (deleted.length === 0) return null;

  return (
    <div className="space-y-3">
      <Notice state={state} />
      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {deleted.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-slate-900">{row.name}</span>
                <span className="font-mono text-slate-400">{row.slug}</span>
                <span
                  className={adminBadgeVariants({
                    tone: row.daysLeft <= 5 ? "red" : "amber",
                  })}
                >
                  {row.daysLeft === 0
                    ? "purges on next sweep"
                    : `${row.daysLeft}d left to restore`}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Deleted{" "}
                {row.deletedAt
                  ? new Date(row.deletedAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "recently"}{" "}
                | automatic purge after{" "}
                {row.purgeAfter
                  ? new Date(row.purgeAfter).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "30 days"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {canRestore ? (
                <button
                  type="button"
                  disabled={pending}
                  className={adminButtonVariants({ tone: "primary", size: "sm" })}
                  onClick={() =>
                    startTransition(async () => {
                      const res = await restoreSiteAction({ siteId: row.id });
                      setState(res);
                      if (res.ok) router.refresh();
                    })
                  }
                >
                  Restore
                </button>
              ) : null}
              {canPurge ? (
                <button
                  type="button"
                  disabled={pending}
                  className={adminButtonVariants({ tone: "danger", size: "sm" })}
                  onClick={() => setConfirmPurge(row)}
                >
                  Purge now
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal
        open={confirmPurge !== null}
        title="Permanently purge site"
        description={
          confirmPurge
            ? `Permanently purge "${confirmPurge.name}"? Every page, version, media file, and domain record for this site will be erased immediately.`
            : ""
        }
        confirmLabel="Purge permanently"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmPurge(null)}
        onConfirm={() => {
          if (!confirmPurge) return;
          const targetId = confirmPurge.id;
          setConfirmPurge(null);
          startTransition(async () => {
            const res = await purgeSiteAction({ siteId: targetId });
            setState(res);
            if (res.ok) router.refresh();
          });
        }}
      />
    </div>
  );
}
