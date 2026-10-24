"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyTemplateAction, retireTemplateAction } from "@/lib/actions/templates";
import type { ActionResult } from "./action";
import { Notice } from "./action";

type TemplateInfo = {
  id: string;
  name: string;
  description: string;
  category: string;
  accent: string;
  status: string;
  scope: string;
  sections: number;
  placeholders: { key: string; label: string; defaultValue: string; kind: string }[];
  updatedAt: string;
};

export function TemplateCard({
  template,
  sites,
}: {
  template: TemplateInfo;
  sites: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "");
  const [title, setTitle] = useState(template.name);
  const [slug, setSlug] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(template.placeholders.map((placeholder) => [placeholder.key, placeholder.defaultValue])),
  );
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <article className="panel flex flex-col overflow-hidden">
      <div className="relative h-24 overflow-hidden" style={{ background: `linear-gradient(120deg, ${template.accent}33, #0b1120)` }}>
        <div className="absolute inset-0 flex items-end gap-1 p-3">
          {Array.from({ length: Math.min(template.sections, 8) }).map((_, index) => (
            <span
              key={index}
              className="block flex-1 rounded-sm"
              style={{ background: template.accent, opacity: 0.15 + (index % 3) * 0.18, height: `${30 + ((index * 17) % 55)}%` }}
            />
          ))}
        </div>
        <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
          {template.category}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-ink-900">{template.name}</h3>
          <span className={`badge ${template.status === "active" ? "badge-green" : "badge-gray"}`}>{template.status}</span>
          {template.scope === "staff" ? <span className="badge badge-amber">staff</span> : null}
        </div>
        <p className="text-xs leading-relaxed text-slate-500">{template.description}</p>
        <p className="text-[11px] text-slate-400">
          {template.sections} sections · {template.placeholders.length} placeholders · updated {template.updatedAt}
        </p>
        {open ? (
          <div className="mt-1 space-y-2.5 rounded-lg border border-line bg-paper/60 p-3">
            {sites.length === 0 ? (
              <p className="text-[11px] text-slate-500">Create a site first.</p>
            ) : (
              <>
                <div>
                  <label className="label" htmlFor={`site-${template.id}`}>
                    Site
                  </label>
                  <select id={`site-${template.id}`} className="select" value={siteId} onChange={(event) => setSiteId(event.target.value)}>
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor={`title-${template.id}`}>
                      Title
                    </label>
                    <input id={`title-${template.id}`} className="input" value={title} onChange={(event) => setTitle(event.target.value)} />
                  </div>
                  <div>
                    <label className="label" htmlFor={`slug-${template.id}`}>
                      URL path
                    </label>
                    <input id={`slug-${template.id}`} className="input" value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="optional" />
                  </div>
                </div>
                {template.placeholders.map((placeholder) => (
                  <div key={placeholder.key}>
                    <label className="label" htmlFor={`${template.id}-${placeholder.key}`}>
                      {placeholder.label}
                    </label>
                    <input
                      id={`${template.id}-${placeholder.key}`}
                      className="input"
                      type={placeholder.kind === "number" ? "number" : "text"}
                      value={values[placeholder.key] ?? ""}
                      onChange={(event) => setValues((current) => ({ ...current, [placeholder.key]: event.target.value }))}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="btn-admin btn-admin-primary w-full"
                  disabled={pending || !siteId}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await applyTemplateAction({
                        siteId,
                        templateId: template.id,
                        title,
                        slug,
                        values,
                      });
                      setState(result);
                      if (result.ok && result.pageId) router.push(`/edit/${siteId}/${result.pageId}`);
                    })
                  }
                >
                  {pending ? "Creating…" : "Create draft from template"}
                </button>
              </>
            )}
            <Notice state={state} />
          </div>
        ) : null}

        <div className="mt-auto flex items-center gap-2 pt-1">
          <button
            type="button"
            className="btn-admin btn-admin-secondary !py-1.5 !text-xs"
            onClick={() => setOpen((current) => !current)}
            disabled={sites.length === 0}
          >
            {open ? "Close" : "Use template"}
          </button>
          {template.scope === "staff" && template.status === "active" ? (
            <button
              type="button"
              className="text-[11px] text-slate-500 underline hover:text-red-600"
              disabled={pending}
              onClick={() => {
                if (!window.confirm("Retire this staff template?")) return;
                startTransition(async () => {
                  const result = await retireTemplateAction({ templateId: template.id });
                  setState(result);
                  router.refresh();
                });
              }}
            >
              Retire
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
