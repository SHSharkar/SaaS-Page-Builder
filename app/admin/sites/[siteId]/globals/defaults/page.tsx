import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePermission, requireView } from "@/lib/auth/session";
import { getSite } from "@/lib/sites";
import {
  GLOBAL_INFO,
  defaultDisclosureDocument,
  defaultFooterDocument,
  defaultHeaderDocument,
  ensureDefaultGlobals,
  saveGlobalsDraft,
} from "@/lib/globals";
import { GLOBAL_CONTENT_KINDS, type GlobalContentKind } from "@/lib/enums";
import { Panel } from "@/components/admin/ui";
import { adminButtonVariants } from "@/lib/theme-classes";

async function resetGlobalAction(formData: FormData) {
  "use server";
  const actor = await requirePermission("globals.edit");
  const siteId = String(formData.get("siteId") ?? "");
  const kind = String(formData.get("kind") ?? "") as GlobalContentKind;
  if (!(GLOBAL_CONTENT_KINDS as readonly string[]).includes(kind)) {
    throw new Error("Unknown global content kind.");
  }
  const site = await getSite(siteId);
  if (!site) throw new Error("Site not found.");
  await ensureDefaultGlobals(siteId, site.name);
  const doc =
    kind === "navigation"
      ? defaultHeaderDocument(site.name)
      : kind === "footer"
        ? defaultFooterDocument(site.name)
        : defaultDisclosureDocument(site.name);
  await saveGlobalsDraft(siteId, kind, doc, actor);
  redirect(`/admin/sites/${siteId}/globals`);
}

export default async function ResetGlobalsDefaultsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  await requireView("globals.edit", `/admin/sites/${siteId}/globals/defaults`);
  const site = await getSite(siteId);
  if (!site) notFound();

  return (
    <div className="space-y-6">
      <Panel
        title="Restore starter global content"
        description="Replaces the selected global region with its clean starter layout."
        actions={
          <Link
            href={`/admin/sites/${siteId}/globals`}
            className={adminButtonVariants({ tone: "secondary", size: "sm" })}
          >
            Back to globals
          </Link>
        }
      >
        <div className="divide-y divide-slate-200">
          {GLOBAL_CONTENT_KINDS.map((kind) => (
            <form
              key={kind}
              action={resetGlobalAction}
              className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0"
            >
              <input type="hidden" name="siteId" value={siteId} />
              <input type="hidden" name="kind" value={kind} />
              <div>
                <p className="text-sm font-semibold text-slate-950">{GLOBAL_INFO[kind].label}</p>
                <p className="text-xs text-slate-500">{GLOBAL_INFO[kind].description}</p>
              </div>
              <button
                type="submit"
                className={adminButtonVariants({ tone: "secondary", size: "sm" })}
              >
                Reset {GLOBAL_INFO[kind].label.toLowerCase()}
              </button>
            </form>
          ))}
        </div>
      </Panel>
    </div>
  );
}
