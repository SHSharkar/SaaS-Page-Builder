"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { purgeSiteAction, restoreSiteAction } from "@/lib/actions/sites";
import type { ActionResult } from "./action";
import { Notice } from "./action";

export type DeletedSite = {
  id: string;
  name: string;
  slug: string;
  deletedAt: string | null;
  restorableUntil: string | null;
};

export function DeletedSites({ sites }: { sites: DeletedSite[] }) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      setState(result);
      router.refresh();
    });

  if (!sites.length) return null;

  return (
    <section className="panel mt-5">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold text-ink-900">Recently deleted</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Serving stopped the moment they were deleted. Rows stay for a restore window, then the daily sweeper
          purges them for good.
        </p>
      </div>
      <ul className="divide-y divide-line">
        {sites.map((site) => {
          const expired = site.restorableUntil ? new Date(site.restorableUntil) < new Date() : false;
          return (
            <li key={site.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink-900">{site.name}</p>
                <p className="text-[11px] text-slate-400">
                  /{site.slug} · deleted {site.deletedAt ? new Date(site.deletedAt).toLocaleDateString("en-GB") : "—"}
                  {site.restorableUntil
                    ? expired
                      ? " · restore window closed"
                      : ` · restorable until ${new Date(site.restorableUntil).toLocaleDateString("en-GB")}`
                    : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                  disabled={pending || expired}
                  onClick={() => run(() => restoreSiteAction({ siteId: site.id }))}
                  title={expired ? "The restore window has closed" : undefined}
                >
                  Restore
                </button>
                <button
                  type="button"
                  className="btn-admin btn-admin-danger !px-2.5 !py-1 !text-[11px]"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Purge ${site.name} and every page, snapshot and file that belongs to it? This cannot be undone.`)) return;
                    run(() => purgeSiteAction({ siteId: site.id }));
                  }}
                >
                  Purge now
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="px-5 pb-4">
        <Notice state={state} />
      </div>
    </section>
  );
}
