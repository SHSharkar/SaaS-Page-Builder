"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyImportAction, discardImportAction } from "@/lib/actions/imports";
import type { ImportReviewDecision, ImportSegment, ImportUnmapped } from "@/lib/documents";
import type { ActionResult } from "./action";
import { Notice } from "./action";

type Alias = { alias: string; name: string; group: string };

type Decision = {
  keep: boolean;
  alias: string;
  props: Record<string, unknown>;
};

function textOverrides(props: Record<string, unknown>): { key: string; value: string }[] {
  return Object.entries(props)
    .filter(([, value]) => typeof value === "string" && value.length > 0 && value.length <= 400)
    .slice(0, 4)
    .map(([key, value]) => ({ key, value: value as string }));
}

export function ImportReview({
  siteId,
  jobId,
  segments,
  unmapped,
  aliases,
  defaultTitle,
  defaultSlug,
  counts,
}: {
  siteId: string;
  jobId: string;
  segments: ImportSegment[];
  unmapped: ImportUnmapped[];
  aliases: Alias[];
  defaultTitle: string;
  defaultSlug: string;
  counts: { sections: number; mapped: number; unmapped: number };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug);
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(
      segments.map((segment) => [
        segment.id,
        { keep: true, alias: segment.proposedAlias, props: { ...segment.props } },
      ]),
    ),
  );

  const kept = useMemo(() => Object.values(decisions).filter((decision) => decision.keep).length, [decisions]);

  const update = (id: string, patch: Partial<Decision>) =>
    setDecisions((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  function apply() {
    startTransition(async () => {
      const payload: ImportReviewDecision[] = segments.map((segment) => {
        const decision = decisions[segment.id];
        return {
          segmentId: segment.id,
          decision: !decision.keep ? "removed" : decision.alias === segment.proposedAlias ? "accepted" : "remapped",
          alias: decision.alias,
          props: decision.props,
          decidedBy: "staff",
          decidedAt: new Date().toISOString(),
        };
      });
      const result = await applyImportAction({ siteId, jobId, title, slug, decisions: payload });
      setState(result);
      if (result.ok && result.pageId) router.push(`/edit/${siteId}/${result.pageId}`);
    });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <strong className="font-semibold">Review is mandatory.</strong> This is a proposal, not an import: {counts.mapped} of{" "}
        {counts.sections} sections were recognised, {counts.unmapped} were not. Nothing exists until you apply it.
      </div>
      <div className="panel">
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="import-title">
              Page title
            </label>
            <input id="import-title" className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="import-slug">
              URL path
            </label>
            <input id="import-slug" className="input" value={slug} onChange={(event) => setSlug(event.target.value)} />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {segments.map((segment, index) => {
          const decision = decisions[segment.id];
          const overrides = textOverrides(decision.props);
          return (
            <section
              key={segment.id}
              className={`panel overflow-hidden ${decision.keep ? "" : "opacity-60"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Section {index + 1}
                    </span>
                    <span className="text-[13px] font-semibold text-ink-900">{segment.label}</span>
                    <span
                      className={`badge ${
                        segment.confidence >= 0.8 ? "badge-green" : segment.confidence >= 0.55 ? "badge-amber" : "badge-red"
                      }`}
                    >
                      {Math.round(segment.confidence * 100)}% conf.
                    </span>
                  </div>
                  <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-slate-500">{segment.excerpt}</p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {segment.shape.headings.length} headings · {segment.shape.paragraphs} paragraphs ·{" "}
                    {segment.shape.buttons} buttons · {segment.shape.images} images · {segment.assetUrls.length} remote
                    assets
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">Why: {segment.reason}</p>
                </div>
                <label className="flex items-center gap-2 text-[12px] font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={decision.keep}
                    onChange={(event) => update(segment.id, { keep: event.target.checked })}
                  />
                  Keep
                </label>
              </div>
              {decision.keep ? (
                <div className="grid gap-3 p-5 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor={`alias-${segment.id}`}>
                      Component
                    </label>
                    <select
                      id={`alias-${segment.id}`}
                      className="select"
                      value={decision.alias}
                      onChange={(event) => update(segment.id, { alias: event.target.value })}
                    >
                      {aliases.map((alias) => (
                        <option key={alias.alias} value={alias.alias}>
                          {alias.name} · {alias.group}
                        </option>
                      ))}
                    </select>
                  </div>
                  {overrides.map((override) => (
                    <div key={override.key}>
                      <label className="label" htmlFor={`${segment.id}-${override.key}`}>
                        {override.key.replace(/_/g, " ")}
                      </label>
                      <input
                        id={`${segment.id}-${override.key}`}
                        className="input"
                        value={String(decision.props[override.key] ?? "")}
                        onChange={(event) =>
                          update(segment.id, { props: { ...decision.props, [override.key]: event.target.value } })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
      {unmapped.length ? (
        <section className="panel">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink-900">Sections the analyser skipped</h2>
            <p className="mt-0.5 text-xs text-slate-500">They are dropped only if you apply — nothing here is guessed silently.</p>
          </div>
          <ul className="divide-y divide-line">
            {unmapped.map((item) => (
              <li key={`${item.index}-${item.label}`} className="px-5 py-2.5">
                <p className="text-[12px] font-medium text-ink-900">
                  #{item.index + 1} {item.label}
                </p>
                <p className="text-[11px] text-slate-500">{item.reason}</p>
                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-400">{item.excerpt}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-2 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <button type="button" className="btn-admin btn-admin-primary" disabled={pending || kept === 0} onClick={apply}>
          {pending ? "Applying…" : `Apply ${kept} section${kept === 1 ? "" : "s"} as a draft`}
        </button>
        <button
          type="button"
          className="btn-admin btn-admin-secondary"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Discard this import? The uploaded file stays in the media library.")) return;
            startTransition(async () => {
              const result = await discardImportAction({ siteId, jobId });
              setState(result);
              if (result.ok) router.push(`/admin/sites/${siteId}/imports`);
            });
          }}
        >
          Discard
        </button>
        <span className="text-[11px] text-slate-500">The page is created unpublished; publish it separately.</span>
      </div>
      <Notice state={state} />
    </div>
  );
}
