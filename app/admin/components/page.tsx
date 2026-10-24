import Link from "next/link";
import type { Metadata } from "next";
import { GROUPS, searchCatalog, REGISTRY_STATS, defaultPropsFor } from "@/lib/registry";
import { requireView } from "@/lib/auth/session";
import { PageHeader, Panel } from "@/components/admin/ui";
import { DEFAULT_THEME } from "@/lib/documents";
import { themeStyle } from "@/lib/render";
import type { Appearance } from "@/lib/registry/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Component library" };

export default async function ComponentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; group?: string }>;
}) {
  await requireView("catalog.view");
  const { q = "", group = "all" } = await searchParams;
  const blocks = searchCatalog(q, { includeDeprecated: true }).filter(
    (block) => group === "all" || block.group === group,
  );
  const byGroup = new Map<string, typeof blocks>();
  for (const block of blocks) {
    byGroup.set(block.group, [...(byGroup.get(block.group) ?? []), block]);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Registry"
        title="Component library"
        description={`${REGISTRY_STATS.launch} launch components plus ${REGISTRY_STATS.waveTwo} in the second wave, across ${REGISTRY_STATS.groups} groups. One definition per component feeds the editor, the importer, the generator prompt and the server validator.`}
        actions={<span className="badge badge-gray">{REGISTRY_STATS.total} defined</span>}
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <form className="flex flex-1 items-center gap-2" action="/admin/components">
          <input name="q" defaultValue={q} placeholder="Search by name, alias or intent…" className="input max-w-sm" />
          {group !== "all" ? <input type="hidden" name="group" value={group} /> : null}
          <button type="submit" className="btn-admin btn-admin-secondary !py-2">
            Search
          </button>
          {q ? (
            <Link href={`/admin/components${group !== "all" ? `?group=${group}` : ""}`} className="text-xs text-slate-500 underline">
              Clear
            </Link>
          ) : null}
        </form>
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={`/admin/components${q ? `?q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${
              group === "all" ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-slate-600"
            }`}
          >
            All
          </Link>
          {GROUPS.map((entry) => (
            <Link
              key={entry.key}
              href={`/admin/components?group=${entry.key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-medium ${
                group === entry.key ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-white text-slate-600"
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </div>
      </div>

      {[...byGroup.entries()].map(([groupKey, groupBlocks]) => {
        const meta = GROUPS.find((entry) => entry.key === groupKey);
        return (
          <section key={groupKey} className="mb-6">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-ink-900">{meta?.label ?? groupKey}</h2>
              <p className="text-[11px] text-slate-400">{meta?.description}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groupBlocks.map((block) => {
                const props = defaultPropsFor(block.alias);
                return (
                  <Panel key={block.alias} className="flex flex-col overflow-hidden">
                    <div className="border-b border-line px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[13px] font-semibold text-ink-900">{block.name}</h3>
                        <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
                          {block.alias}
                        </code>
                        {block.deprecated ? <span className="badge badge-red">deprecated</span> : null}
                        {block.wave === 2 ? <span className="badge badge-blue">wave 2</span> : null}
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{block.description}</p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {block.fields.length} fields · {Object.keys(block.defaults).length} defaults
                      </p>
                    </div>
                    <details className="group">
                      <summary className="cursor-pointer px-4 py-2 text-[11px] font-medium text-slate-600 hover:bg-paper">
                        Preview and schema
                      </summary>
                      <div
                        className="site-scope pointer-events-none max-h-[300px] overflow-hidden border-y border-line"
                        style={themeStyle(DEFAULT_THEME)}
                        aria-hidden="true"
                      >
                        {block.render({
                          ...props,
                          appearance: (props.appearance ?? {}) as Appearance,
                        } as never)}
                      </div>
                      <ul className="max-h-60 space-y-1 overflow-y-auto px-4 py-3">
                        {block.fields.map((field) => (
                          <li key={field.key} className="flex items-baseline justify-between gap-2 text-[11px]">
                            <span className="text-slate-600">{field.label}</span>
                            <code className="shrink-0 font-mono text-[10px] text-slate-400">{field.type}</code>
                          </li>
                        ))}
                      </ul>
                    </details>
                  </Panel>
                );
              })}
            </div>
          </section>
        );
      })}

      {blocks.length === 0 ? (
        <Panel>
          <p className="text-sm text-slate-500">Nothing matches “{q}”.</p>
        </Panel>
      ) : null}
    </div>
  );
}
