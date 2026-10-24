import { requireView } from "@/lib/auth/session";
import { COMPONENT_LIST, GROUP_LABELS, type ComponentGroup } from "@/lib/registry";
import { PageHeader, Panel } from "@/components/admin/ui";
import { adminBadgeVariants } from "@/lib/theme-classes";

const GROUPS: ComponentGroup[] = ["site-frame", "conversion", "money", "content", "utility"];

export default async function ComponentsCatalogPage() {
  await requireView("catalog.view", "/admin/components");

  const activeList = COMPONENT_LIST.filter((c) => !c.deprecated);
  const launchCount = activeList.filter((c) => (c.wave ?? 1) === 1).length;
  const wave2Count = activeList.filter((c) => c.wave === 2).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Block catalog"
        title={`Registered components (${activeList.length})`}
        description={`${launchCount} launch components and ${wave2Count} wave-2 components validated with Zod schemas and rendered identically in editor and public pages.`}
      />

      {GROUPS.map((group) => {
        const items = activeList.filter((item) => item.group === group);
        return (
          <Panel key={group} title={`${GROUP_LABELS[group]} (${items.length})`}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const waveLabel = (item.wave ?? 1) === 1 ? "launch" : "wave-2";
                return (
                  <div
                    key={item.type}
                    className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                      <div className="flex items-center gap-1.5">
                        {item.adminOnly ? (
                          <span className={adminBadgeVariants({ tone: "amber" })}>admin only</span>
                        ) : null}
                        <span
                          className={adminBadgeVariants({
                            tone: waveLabel === "launch" ? "green" : "blue",
                          })}
                        >
                          {waveLabel}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-slate-400">{item.type}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                      {item.description}
                    </p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {item.fields.length} editable field
                      {item.fields.length === 1 ? "" : "s"}
                    </p>
                  </div>
                );
              })}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
