"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyImportAction, discardImportAction } from "@/lib/actions/imports";
import { COMPONENT_LIST } from "@/lib/registry";
import type { ImportSegment } from "@/lib/documents";
import type { SegmentDecisionInput } from "@/lib/importer";
import { Notice, type ActionResult } from "@/components/admin/action";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
  adminSelectClass,
} from "@/lib/theme-classes";

export function ImportReview({
  siteId,
  jobId,
  sourceName,
  status,
  suggestedTitle,
  segments,
  canApply,
  allowAdminBlocks,
  producedPageId,
}: {
  siteId: string;
  jobId: string;
  sourceName: string;
  status: string;
  suggestedTitle: string;
  segments: ImportSegment[];
  canApply: boolean;
  allowAdminBlocks: boolean;
  producedPageId: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(suggestedTitle || "Imported page");
  const [slug, setSlug] = useState(
    sourceName
      .replace(/\.html?$/i, "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "imported-page",
  );
  const [decisions, setDecisions] = useState<Record<string, SegmentDecisionInput>>(() =>
    Object.fromEntries(
      segments.map((seg) => [
        seg.id,
        {
          id: seg.id,
          decision: seg.decision,
          remapType: seg.suggestedType ?? "rich-text",
        },
      ]),
    ),
  );
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  if (status === "applied" && producedPageId) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        This import has already been turned into a draft page.{" "}
        <a href={`/edit/${siteId}/${producedPageId}`} className="font-semibold underline">
          Open it in the visual editor
        </a>
        .
      </div>
    );
  }

  if (status === "discarded") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        This import job was discarded without creating a page.
      </div>
    );
  }

  const remapChoices = COMPONENT_LIST.filter(
    (c) => !c.deprecated && (allowAdminBlocks || !c.adminOnly),
  );

  const actionOptions: { value: SegmentDecisionInput["decision"]; label: string }[] = [
    { value: "accept", label: "Accept" },
    { value: "remap", label: "Remap block" },
    { value: "skip", label: "Skip" },
    ...(allowAdminBlocks ? [{ value: "raw_html" as const, label: "Raw HTML" }] : []),
  ];

  return (
    <div className="space-y-6">
      {segments.length > 0 ? (
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Detected sections ({segments.length})
          </p>
          {segments.map((seg) => {
            const current = decisions[seg.id] ?? {
              id: seg.id,
              decision: seg.decision,
              remapType: seg.suggestedType ?? "rich-text",
            };
            return (
              <div
                key={seg.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs"
              >
                <div className="min-w-60 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={adminBadgeVariants({ tone: seg.suggestedType ? "green" : "amber" })}>
                      &lt;{seg.sourceTag}&gt;
                    </span>
                    <span className="font-semibold text-slate-900">{seg.label}</span>
                    {seg.suggestedType ? (
                      <span className="font-mono text-[11px] text-slate-500">
                        suggested: {seg.suggestedType} ({Math.round(seg.confidence * 100)}%)
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-800">unmapped region</span>
                    )}
                  </div>
                  <p className="break-words font-mono text-[11px] text-slate-600">
                    {seg.excerpt || "(empty element)"}
                  </p>
                </div>

                {canApply ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {actionOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            setDecisions({
                              ...decisions,
                              [seg.id]: { ...current, decision: opt.value },
                            })
                          }
                          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium ${
                            current.decision === opt.value
                              ? "border-slate-950 bg-slate-950 text-white"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {current.decision === "remap" ? (
                      <select
                        className={adminSelectClass}
                        value={current.remapType ?? "rich-text"}
                        onChange={(e) =>
                          setDecisions({
                            ...decisions,
                            [seg.id]: { ...current, remapType: e.target.value },
                          })
                        }
                      >
                        {remapChoices.map((c) => (
                          <option key={c.alias} value={c.alias}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {canApply ? (
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            startTransition(async () => {
              const res = await applyImportAction({
                siteId,
                jobId,
                title,
                slug,
                decisions: Object.values(decisions),
              });
              setState(res);
              if (res.ok && res.pageId) {
                router.push(`/edit/${siteId}/${res.pageId}`);
              }
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={adminLabelClass} htmlFor="imp-title">
                Draft page title
              </label>
              <input
                id="imp-title"
                className={adminInputClass}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                required
              />
            </div>
            <div>
              <label className={adminLabelClass} htmlFor="imp-slug">
                URL slug
              </label>
              <input
                id="imp-slug"
                className={adminInputClass}
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                required
              />
            </div>
          </div>

          <Notice state={state} />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={pending}
              className={adminButtonVariants({ tone: "danger", size: "sm" })}
              onClick={() => setConfirmDiscard(true)}
            >
              Discard import
            </button>
            <button
              type="submit"
              disabled={pending}
              className={adminButtonVariants({ tone: "primary" })}
            >
              {pending ? "Creating draft..." : "Apply to new draft page"}
            </button>
          </div>
        </form>
      ) : null}

      <ConfirmModal
        open={confirmDiscard}
        title="Discard HTML import"
        description="Discard this import job without creating a page? You can upload the HTML again later."
        confirmLabel="Discard import"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          startTransition(async () => {
            const res = await discardImportAction({ siteId, jobId });
            setState(res);
            if (res.ok) router.refresh();
          });
        }}
      />
    </div>
  );
}
