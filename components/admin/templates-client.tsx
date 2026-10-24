"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyTemplateAction, retireTemplateAction } from "@/lib/actions/templates";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Notice, type ActionResult } from "@/components/admin/action";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
  adminSelectClass,
} from "@/lib/theme-classes";

type TemplateCard = {
  id: string;
  siteId: string | null;
  name: string;
  category: string;
  description: string;
  placeholders: { key: string; label: string; sample: string }[];
  sectionCount: number;
};

type SiteChoice = { id: string; name: string };

export function TemplateGallery({
  templates,
  sites,
  canApply,
  canManage,
}: {
  templates: TemplateCard[];
  sites: SiteChoice[];
  canApply: boolean;
  canManage: boolean;
}) {
  const router = useRouter();
  const [openId, setOpenId] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmRetire, setConfirmRetire] = useState<TemplateCard | null>(null);

  const openModal = (template: TemplateCard) => {
    setOpenId(template.id);
    setTitle(template.name);
    setSlug(
      template.name
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    );
    setValues(
      Object.fromEntries(template.placeholders.map((ph) => [ph.key, ph.sample])),
    );
    setState(null);
  };

  return (
    <div className="space-y-4">
      <Notice state={state} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => {
          const isOpen = openId === template.id;
          const isCurated = template.siteId === null;
          return (
            <div
              key={template.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-600">
                    {template.category}
                  </span>
                  <span className={adminBadgeVariants({ tone: isCurated ? "blue" : "gray" })}>
                    {isCurated ? "curated" : "saved from page"}
                  </span>
                </div>
                <h3 className="mt-2 text-base font-semibold text-slate-950">{template.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                  {template.description}
                </p>
                <p className="mt-3 text-[11px] text-slate-400">
                  {template.sectionCount} sections | {template.placeholders.length} placeholder
                  {template.placeholders.length === 1 ? "" : "s"}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
                {canApply && sites.length > 0 ? (
                  <button
                    type="button"
                    className={adminButtonVariants({ tone: "primary", size: "sm" })}
                    onClick={() => (isOpen ? setOpenId(null) : openModal(template))}
                  >
                    {isOpen ? "Close" : "Use on a site"}
                  </button>
                ) : null}
                {canManage && template.siteId !== null ? (
                  <button
                    type="button"
                    disabled={pending}
                    className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                    onClick={() => setConfirmRetire(template)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>

              {isOpen ? (
                <form
                  className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs"
                  onSubmit={(event) => {
                    event.preventDefault();
                    startTransition(async () => {
                      const res = await applyTemplateAction({
                        siteId,
                        templateId: template.id,
                        title,
                        slug,
                        values,
                      });
                      setState(res);
                      if (res.ok && res.pageId && res.siteId) {
                        router.push(`/edit/${res.siteId}/${res.pageId}`);
                      }
                    });
                  }}
                >
                  <div>
                    <label className={adminLabelClass} htmlFor={`site-${template.id}`}>
                      Target site
                    </label>
                    <select
                      id={`site-${template.id}`}
                      className={adminSelectClass}
                      value={siteId}
                      onChange={(event) => setSiteId(event.target.value)}
                    >
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className={adminLabelClass} htmlFor={`title-${template.id}`}>
                        Page title
                      </label>
                      <input
                        id={`title-${template.id}`}
                        className={adminInputClass}
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className={adminLabelClass} htmlFor={`slug-${template.id}`}>
                        URL slug
                      </label>
                      <input
                        id={`slug-${template.id}`}
                        className={`${adminInputClass} font-mono`}
                        value={slug}
                        onChange={(event) => setSlug(event.target.value)}
                        placeholder="empty = homepage"
                      />
                    </div>
                  </div>
                  {template.placeholders.map((ph) => (
                    <div key={ph.key}>
                      <label
                        className={adminLabelClass}
                        htmlFor={`ph-${template.id}-${ph.key}`}
                      >
                        {ph.label}
                      </label>
                      <input
                        id={`ph-${template.id}-${ph.key}`}
                        className={adminInputClass}
                        value={values[ph.key] ?? ""}
                        onChange={(event) =>
                          setValues({ ...values, [ph.key]: event.target.value })
                        }
                      />
                    </div>
                  ))}
                  <button
                    type="submit"
                    className={`${adminButtonVariants({ tone: "primary" })} w-full`}
                    disabled={pending}
                  >
                    {pending ? "Creating draft..." : "Create draft & open editor"}
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={confirmRetire !== null}
        title="Delete saved template"
        description={
          confirmRetire
            ? `Delete "${confirmRetire.name}"? Existing pages created from this template will remain untouched.`
            : ""
        }
        confirmLabel="Delete template"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmRetire(null)}
        onConfirm={() => {
          if (!confirmRetire || !confirmRetire.siteId) return;
          const target = confirmRetire;
          setConfirmRetire(null);
          startTransition(async () => {
            const res = await retireTemplateAction({
              siteId: target.siteId!,
              templateId: target.id,
            });
            setState(res);
            if (res.ok) router.refresh();
          });
        }}
      />
    </div>
  );
}
