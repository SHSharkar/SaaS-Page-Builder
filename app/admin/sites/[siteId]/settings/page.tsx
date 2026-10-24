import { notFound } from "next/navigation";
import { getSite } from "@/lib/sites";
import { listMedia } from "@/lib/media";
import { requireActor, can } from "@/lib/auth/session";
import { PageHeader } from "@/components/admin/ui";
import { SiteSettings, type ThemeDraft } from "@/components/admin/site-settings";

export const dynamic = "force-dynamic";

export default async function SiteSettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const actor = await requireActor();
  const site = await getSite(siteId);
  if (!site) notFound();
  const media = await listMedia(siteId);

  const theme: ThemeDraft = {
    accent: site.theme.accent,
    accentContrast: site.theme.accentContrast,
    background: site.theme.background,
    surface: site.theme.surface,
    text: site.theme.text,
    muted: site.theme.muted,
    border: site.theme.border,
    headingFont: site.theme.headingFont,
    bodyFont: site.theme.bodyFont,
    radius: site.theme.radius,
    logoText: site.theme.logoText,
    logoMediaId: site.theme.logoMediaId ?? null,
    tagline: site.theme.tagline ?? "",
  };

  return (
    <div>
      <PageHeader
        title="Site settings"
        description="Identity, theme tokens and the irreversible actions."
        breadcrumb={[{ label: site.name, href: `/admin/sites/${siteId}` }, { label: "Settings" }]}
      />
      <SiteSettings
        siteId={siteId}
        name={site.name}
        slug={site.slug}
        status={site.status}
        theme={theme}
        media={media.map((asset) => ({ id: asset.id, alt: asset.altText }))}
        canManage={can(actor, "admin")}
      />
    </div>
  );
}
