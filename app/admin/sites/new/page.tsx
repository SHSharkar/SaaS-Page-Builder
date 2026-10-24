import Link from "next/link";
import { createSiteAction } from "@/lib/actions/sites";
import { requirePermission } from "@/lib/auth/session";
import { PageHeader, Panel, Field } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function NewSitePage() {
  await requirePermission("site.create");

  return (
    <div className="max-w-3xl">
      <PageHeader
        eyebrow="Workspace"
        title="New site"
        description="A site owns one brand: theme, global navigation and footer, pages, media and hostnames. You can start from a template or from an empty canvas."
        breadcrumb={[{ label: "Sites", href: "/admin/sites" }, { label: "New" }]}
      />
      <form action={createSiteAction} className="space-y-5">
        <Panel title="Basics" description="The platform address is generated from the slug.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Site name" htmlFor="name" hint="Shown in the admin sidebar and page titles.">
              <input id="name" name="name" required maxLength={80} className="input" placeholder="Trofeo Reward" />
            </Field>
            <Field label="Slug" htmlFor="slug" hint="Lowercase letters, numbers and dashes. Becomes <slug>.pages.trofeo.pages.">
              <input id="slug" name="slug" maxLength={60} className="input" placeholder="trofeo-reward" />
            </Field>
          </div>
        </Panel>
        <Panel
          title="Brand accent"
          description="Used for buttons, links and highlights. You can refine the full palette later in Settings."
        >
          <Field label="Accent colour" htmlFor="accent" hint="Anything CSS accepts — a hex value is easiest.">
            <input
              id="accent"
              name="accent"
              type="color"
              defaultValue="#c8a24a"
              className="h-10 w-20 cursor-pointer rounded-md border border-line bg-white p-1"
            />
          </Field>
        </Panel>
        <div className="flex items-center gap-2">
          <button type="submit" className="btn-admin btn-admin-primary">
            Create site
          </button>
          <Link href="/admin/sites" className="btn-admin btn-admin-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
