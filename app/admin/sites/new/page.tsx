import Link from "next/link";
import { requireView } from "@/lib/auth/session";
import { createSiteAction } from "@/lib/actions/sites";
import { getSetting } from "@/lib/settings";
import { Field, PageHeader, Panel } from "@/components/admin/ui";
import {
  adminButtonVariants,
  adminInputClass,
  adminSelectClass,
} from "@/lib/theme-classes";

export default async function NewSitePage() {
  await requireView("site.create", "/admin/sites/new");
  const baseDomain = await getSetting("platform.base_domain");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="New brand workspace"
        title="Create a site"
        description="Provisions a built-in subdomain, default header/footer/disclosure globals, and a starter homepage draft."
        breadcrumb={[
          { label: "Sites", href: "/admin/sites" },
          { label: "Create site" },
        ]}
      />

      <Panel>
        <form action={createSiteAction} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand name" htmlFor="name" hint="Displayed in navigation and metadata.">
              <input
                id="name"
                name="name"
                required
                className={adminInputClass}
                placeholder="Velvet Crown"
              />
            </Field>
            <Field
              label="Subdomain slug"
              htmlFor="slug"
              hint={`Becomes <slug>.${baseDomain} automatically.`}
            >
              <input
                id="slug"
                name="slug"
                className={`${adminInputClass} font-mono`}
                placeholder="velvet-crown"
              />
            </Field>
          </div>

          <Field
            label="Initial color palette"
            htmlFor="palette"
            hint="You can switch palettes, typography, and corner radius any time in Site Settings."
          >
            <select id="palette" name="palette" className={adminSelectClass}>
              <option value="obsidian-gold">Obsidian & gold</option>
              <option value="emerald-casino">Emerald & mint</option>
              <option value="midnight-neon">Midnight & violet</option>
              <option value="ivory-editorial">Ivory editorial</option>
            </select>
          </Field>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button type="submit" className={adminButtonVariants({ tone: "primary" })}>
              Create site
            </button>
            <Link href="/admin/sites" className={adminButtonVariants({ tone: "secondary" })}>
              Cancel
            </Link>
          </div>
        </form>
      </Panel>
    </div>
  );
}
