import Link from "next/link";
import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { listTemplates, getTemplate, placeholdersFor } from "@/lib/templates";
import { createPageAction } from "@/lib/actions/pages";
import { requireActor } from "@/lib/auth/session";
import { PageHeader, Panel, Field } from "@/components/admin/ui";
import { BLOCKS } from "@/lib/registry";

export const dynamic = "force-dynamic";

export default async function NewPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { siteId } = await params;
  const { template: templateId } = await searchParams;
  const actor = await requireActor();
  const site = await getSite(siteId);
  if (!site) notFound();

  const templates = await listTemplates({ includeStaff: true, userId: actor.user.id });
  const chosen = templateId ? await getTemplate(templateId) : null;
  const placeholders = chosen ? placeholdersFor(chosen) : [];
  const chosenSections = chosen ? chosen.document.content.length : 0;
  const unknownAliases = chosen
    ? chosen.document.content.filter((block) => !BLOCKS[block.type]).map((block) => block.type)
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="New page"
        title="Start a page"
        description="Pick a starting point, give it a name and a URL. The page is created as a draft you can shape in the visual editor."
        breadcrumb={[
          { label: site.name, href: `/admin/sites/${siteId}` },
          { label: "Pages", href: `/admin/sites/${siteId}/pages` },
          { label: "New" },
        ]}
      />
      <form action={createPageAction} className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <input type="hidden" name="siteId" value={siteId} />
        {chosen ? <input type="hidden" name="templateId" value={chosen.id} /> : null}
        <div className="space-y-5">
          <Panel title="Page details">
            <div className="space-y-3">
              <Field label="Title" htmlFor="title" hint="Appears in the site navigation and as the default SEO title.">
                <input
                  id="title"
                  name="title"
                  required
                  maxLength={120}
                  className="input"
                  defaultValue={chosen?.name ?? ""}
                  placeholder="Summer rewards campaign"
                />
              </Field>
              <Field label="URL path" htmlFor="slug" hint={`Lives at /<path> on ${site.slug}. Leave blank to derive it from the title.`}>
                <input id="slug" name="slug" className="input" placeholder="summer-rewards" />
              </Field>
            </div>
          </Panel>
          {chosen ? (
            <Panel
              title={`Template: ${chosen.name}`}
              description={`${chosenSections} sections · ${placeholders.length} fields to fill in.`}
            >
              {unknownAliases.length ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {unknownAliases.length} section{unknownAliases.length === 1 ? "" : "s"} use a component that is no
                  longer in the library and will be dropped: {unknownAliases.join(", ")}.
                </p>
              ) : null}
              {placeholders.length === 0 ? (
                <p className="text-sm text-slate-500">This template has no placeholders — it will be copied as-is.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {placeholders.map((placeholder) => (
                    <Field key={placeholder.key} label={placeholder.label} htmlFor={`ph-${placeholder.key}`}>
                      <input
                        id={`ph-${placeholder.key}`}
                        name={`ph:${placeholder.key}`}
                        className="input"
                        defaultValue={placeholder.defaultValue}
                        type={placeholder.kind === "number" ? "number" : "text"}
                      />
                    </Field>
                  ))}
                </div>
              )}
            </Panel>
          ) : (
            <Panel title="Start from" description="Templates carry a full page layout you can then edit freely.">
              <div className="space-y-2">
                <Link
                  href={`/admin/sites/${siteId}/pages/new?template=none`}
                  className={`block rounded-xl border px-4 py-3 transition ${
                    !templateId ? "border-ink-900 bg-white" : "border-line bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-ink-900">Blank canvas</p>
                  <p className="mt-0.5 text-xs text-slate-500">An empty page with the site header and footer.</p>
                </Link>
                {templates.map((template) => (
                  <Link
                    key={template.id}
                    href={`/admin/sites/${siteId}/pages/new?template=${template.id}`}
                    className="block rounded-xl border border-line bg-white px-4 py-3 transition hover:border-slate-300"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900">{template.name}</p>
                      <span className="badge badge-gray">{template.category}</span>
                      {template.scope === "staff" ? <span className="badge badge-amber">staff</span> : null}
                      <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: template.accent }} />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{template.description}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {template.document.content.length} sections · {template.placeholders.length} placeholders
                    </p>
                  </Link>
                ))}
                {templates.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    No templates yet.{" "}
                    <Link href="/admin/templates" className="text-ink-900 underline">
                      Browse the library
                    </Link>
                    .
                  </p>
                ) : null}
              </div>
            </Panel>
          )}
        </div>
        <div className="space-y-4">
          <Panel title="What happens next">
            <ol className="space-y-2.5 text-[13px] text-slate-600">
              <li>1. The page is created as a draft — nothing appears publicly.</li>
              <li>2. The visual editor opens with the component library on the left.</li>
              <li>3. Save draft as often as you like; publishing writes an immutable snapshot.</li>
              <li>4. Preview stays staff-only and noindex until you publish.</li>
            </ol>
          </Panel>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" className="btn-admin btn-admin-primary">
              Create draft
            </button>
            <Link href={`/admin/sites/${siteId}/pages`} className="btn-admin btn-admin-secondary">
              Cancel
            </Link>
          </div>
        </div>
      </form>
    </div>
  );
}
