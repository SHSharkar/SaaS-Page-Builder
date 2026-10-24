import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { getDefaultSeo } from "@/lib/globals";
import { requireActor } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { DefaultSeoForm } from "@/components/admin/default-seo-form";

export const dynamic = "force-dynamic";

export default async function DefaultSeoPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  await requireActor();
  const site = await getSite(siteId);
  if (!site) notFound();
  const seo = await getDefaultSeo(siteId);

  return (
    <div>
      <PageHeader
        eyebrow="Global content"
        title="Default search tags"
        description="Site-wide fallbacks for titles, descriptions and indexing. A page's own settings always take precedence."
        breadcrumb={[
          { label: site.name, href: `/admin/sites/${siteId}` },
          { label: "Global content", href: `/admin/sites/${siteId}/globals` },
          { label: "Default tags" },
        ]}
      />
      <DefaultSeoForm
        siteId={siteId}
        siteName={site.name}
        tagline={site.theme.tagline ?? ""}
        initial={{
          titleSuffix: "",
          description: seo.description ?? "",
          ogDescription: seo.ogDescription ?? "",
          keywords: seo.keywords ?? "",
          noindex: seo.noindex ?? false,
        }}
      />
    </div>
  );
}
