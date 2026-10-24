import Link from "next/link";
import { notFound } from "next/navigation";
import { requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import { listTemplates } from "@/lib/templates";
import { createPageFormAction } from "@/lib/actions/pages";
import { Field, Panel } from "@/components/admin/ui";
import {
  adminButtonVariants,
  adminInputClass,
  adminSelectClass,
} from "@/lib/theme-classes";

export default async function NewSitePageRoute({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireView("page.create", `/admin/sites/${siteId}/pages/new`);
  const site = await getSite(siteId);
  if (!site) notFound();

  const templates = await listTemplates(siteId);

  return (
    <Panel
      title="Create a new page"
      description="Starts as a private draft and opens straight in the visual editor."
    >
      <form action={createPageFormAction} className="space-y-5">
        <input type="hidden" name="siteId" value={siteId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Page title" htmlFor="title" hint="Used in headings and browser tabs.">
            <input
              id="title"
              name="title"
              required
              className={adminInputClass}
              placeholder="VIP Autumn Reload"
            />
          </Field>
          <Field
            label="URL slug"
            htmlFor="slug"
            hint="Leave empty only if this page should serve the site root (/)."
          >
            <input
              id="slug"
              name="slug"
              className={`${adminInputClass} font-mono`}
              placeholder="vip-autumn-reload"
            />
          </Field>
        </div>

        <Field
          label="Starter layout"
          htmlFor="templateId"
          hint="Creates an independent copy of the selected template."
        >
          <select id="templateId" name="templateId" className={adminSelectClass}>
            <option value="">Default starter hero + promo layout</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} ({tpl.category})
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <button type="submit" className={adminButtonVariants({ tone: "primary" })}>
            Create draft & open editor
          </button>
          <Link
            href={`/admin/sites/${siteId}/pages`}
            className={adminButtonVariants({ tone: "secondary" })}
          >
            Cancel
          </Link>
        </div>
      </form>
    </Panel>
  );
}
