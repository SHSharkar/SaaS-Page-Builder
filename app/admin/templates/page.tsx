import Link from "next/link";
import { listTemplates, placeholdersFor } from "@/lib/templates";
import { listSites } from "@/lib/sites";
import { requireView } from "@/lib/auth/session";
import { PageHeader, Panel, StatusBadge, relativeTime } from "@/components/admin/ui";
import { TemplateCard } from "@/components/admin/template-card";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const actor = await requireView("template.view");
  const [templates, sites] = await Promise.all([
    listTemplates({ includeStaff: true, userId: actor.user.id }),
    listSites(),
  ]);
  const platform = templates.filter((template) => template.scope === "platform");
  const staff = templates.filter((template) => template.scope === "staff");

  return (
    <div>
      <PageHeader
        eyebrow="Library"
        title="Templates"
        description="Curated starting points with fill-in placeholders, plus anything the team has saved. A template is copied — editing a page never changes it."
        actions={
          sites[0] ? (
            <Link href={`/admin/sites/${sites[0].site.id}/pages/new`} className="btn-admin btn-admin-primary">
              Start from a template
            </Link>
          ) : null
        }
      />
      <div className="space-y-6">
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Curated</h2>
            <p className="text-[11px] text-slate-400">{platform.length} designs maintained by the platform team</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {platform.map((template) => (
              <TemplateCard
                key={template.id}
                template={{
                  id: template.id,
                  name: template.name,
                  description: template.description,
                  category: template.category,
                  accent: template.accent,
                  status: template.status,
                  scope: template.scope,
                  sections: template.document.content.length,
                  placeholders: placeholdersFor(template).map((placeholder) => ({
                    key: placeholder.key,
                    label: placeholder.label,
                    defaultValue: placeholder.defaultValue,
                    kind: placeholder.kind,
                  })),
                  updatedAt: relativeTime(template.updatedAt),
                }}
                sites={sites.map((row) => ({ id: row.site.id, name: row.site.name }))}
              />
            ))}
            {platform.length === 0 ? (
              <p className="text-sm text-slate-500">No curated templates yet.</p>
            ) : null}
          </div>
        </section>
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink-900">Saved by the team</h2>
            <p className="text-[11px] text-slate-400">Staff templates are private to their author unless shared</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {staff.map((template) => (
              <TemplateCard
                key={template.id}
                template={{
                  id: template.id,
                  name: template.name,
                  description: template.description,
                  category: template.category,
                  accent: template.accent,
                  status: template.status,
                  scope: template.scope,
                  sections: template.document.content.length,
                  placeholders: placeholdersFor(template).map((placeholder) => ({
                    key: placeholder.key,
                    label: placeholder.label,
                    defaultValue: placeholder.defaultValue,
                    kind: placeholder.kind,
                  })),
                  updatedAt: relativeTime(template.updatedAt),
                }}
                sites={sites.map((row) => ({ id: row.site.id, name: row.site.name }))}
              />
            ))}
            {staff.length === 0 ? (
              <Panel>
                <p className="text-sm text-slate-500">
                  Nothing saved yet. Open any page&apos;s settings and choose “Save as template” to add one here.
                </p>
              </Panel>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
