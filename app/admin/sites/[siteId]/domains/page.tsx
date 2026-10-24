import { notFound } from "next/navigation";
import Link from "next/link";
import { getSite, listSiteDomains, platformHost } from "@/lib/sites";
import { verificationRecord } from "@/lib/domains";
import { requireView, can } from "@/lib/auth/session";
import { PageHeader, Panel } from "@/components/admin/ui";
import { DomainsPanel } from "@/components/admin/domains-panel";

export const dynamic = "force-dynamic";

export default async function SiteDomainsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const actor = await requireView("domain.view");
  const site = await getSite(siteId);
  if (!site) notFound();
  const domains = await listSiteDomains(siteId);

  return (
    <div>
      <PageHeader
        title="Domains"
        description="Hostname resolution and certificates. A hostname never receives a certificate before its DNS record verifies."
        breadcrumb={[{ label: site.name, href: `/admin/sites/${siteId}` }, { label: "Domains" }]}
      />

      <DomainsPanel
        siteId={siteId}
        platformHost={platformHost(site.slug)}
        canManage={can(actor, "admin")}
        domains={domains.map((domain) => {
          const record = verificationRecord(domain.hostname, domain.verificationToken ?? "");
          return {
            id: domain.id,
            hostname: domain.hostname,
            kind: domain.kind,
            status: domain.status,
            isPrimary: domain.isPrimary,
            certificateState: domain.certificateState,
            failureReason: domain.failureReason,
            verificationName: record.name,
            verificationValue: record.value,
            verifiedAt: domain.verifiedAt ? domain.verifiedAt.toISOString() : null,
          };
        })}
      />

      <Panel className="mt-5" title="Certificate flow" description="Verification, then issuance — the order matters.">
        <ol className="space-y-1.5 text-[13px] text-slate-600">
          <li>1. Add the hostname; a single-use TXT token is generated.</li>
          <li>2. The worker checks DNS on a backoff schedule for seven days.</li>
          <li>3. On success the row becomes active and the certificate gate answers yes for that host.</li>
          <li>4. Removing the hostname makes the gate answer no — traffic stops at once.</li>
        </ol>
        <p className="mt-2 text-[11px] text-slate-400">
          Sandbox note: outbound DNS lookups are not available here, so verification returns a recheck-later message
          instead of a false positive. See{" "}
          <Link href="/admin/settings" className="underline">
            platform settings
          </Link>
          .
        </p>
      </Panel>
    </div>
  );
}
