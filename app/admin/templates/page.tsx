import { can, requireView } from "@/lib/auth/session";
import { extractTemplatePlaceholders, listTemplates } from "@/lib/templates";
import { listSites } from "@/lib/sites";
import { EmptyState, PageHeader } from "@/components/admin/ui";
import { TemplateGallery } from "@/components/admin/templates-client";

export default async function TemplatesPage() {
  const actor = await requireView("template.view", "/admin/templates");
  const [templates, allSites] = await Promise.all([listTemplates(), listSites()]);

  const activeSites = allSites
    .filter((entry) => entry.site.status === "active")
    .map((entry) => ({ id: entry.site.id, name: entry.site.name }));

  const cards = templates.map((tpl) => ({
    id: tpl.id,
    siteId: tpl.siteId,
    name: tpl.name,
    category: tpl.category,
    description: tpl.description,
    placeholders: extractTemplatePlaceholders(tpl.document).map((ph) => ({
      key: ph.key,
      label: ph.label,
      sample: ph.defaultValue,
    })),
    sectionCount: tpl.document.content?.length ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Starter layouts"
        title="Reusable templates"
        description="Curated landing layouts and saved page blueprints. Applying a template creates an independent draft copy."
      />

      {cards.length === 0 ? (
        <EmptyState
          title="No templates available"
          description="Save any page as a template from its detail view to populate this gallery."
        />
      ) : (
        <TemplateGallery
          templates={cards}
          sites={activeSites}
          canApply={can(actor, "template.apply")}
          canManage={can(actor, "template.manage")}
        />
      )}
    </div>
  );
}
