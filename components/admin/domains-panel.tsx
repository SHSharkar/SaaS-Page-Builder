"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDomainAction,
  makePrimaryDomainAction,
  removeDomainAction,
  retryDomainAction,
  verifyDomainAction,
} from "@/lib/actions/sites";
import type { ActionResult } from "./action";
import { CopyInline, Notice } from "./action";

type DomainRow = {
  id: string;
  hostname: string;
  kind: string;
  status: string;
  isPrimary: boolean;
  certificateState: string;
  failureReason: string | null;
  verificationName: string;
  verificationValue: string;
  verifiedAt: string | null;
};

const TONE: Record<string, string> = {
  active: "badge badge-green",
  pending: "badge badge-amber",
  verifying: "badge badge-blue",
  failed: "badge badge-red",
  removed: "badge badge-gray",
};

export function DomainsPanel({
  siteId,
  platformHost,
  domains,
  canManage,
}: {
  siteId: string;
  platformHost: string;
  domains: DomainRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [hostname, setHostname] = useState("");
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      setState(result);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <Notice state={state} />

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Connect a custom domain</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Up to ten hostnames per site. The hostname starts serving only after the TXT record verifies and the
            certificate is issued.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 p-5">
          <div className="min-w-[260px] flex-1">
            <label className="label" htmlFor="hostname">
              Hostname
            </label>
            <input
              id="hostname"
              className="input"
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
              placeholder="offers.example.com"
            />
          </div>
          <button
            type="button"
            className="btn-admin btn-admin-primary"
            disabled={pending || hostname.trim().length < 4}
            onClick={() =>
              run(async () => {
                const result = await addDomainAction({ siteId, hostname });
                if (result.ok) setHostname("");
                return result;
              })
            }
          >
            {pending ? "Working…" : "Add domain"}
          </button>
        </div>
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Hostnames</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            The platform subdomain {platformHost} always works, whatever happens to the custom domains.
          </p>
        </div>
        <ul className="divide-y divide-line">
          {domains.map((domain) => (
            <li key={domain.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[13px] text-ink-900">{domain.hostname}</span>
                    <span className={TONE[domain.status] ?? "badge badge-gray"}>{domain.status}</span>
                    {domain.isPrimary ? <span className="badge badge-blue">primary</span> : null}
                    <span className="badge badge-gray">cert: {domain.certificateState}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {domain.kind === "custom" ? "Custom domain" : "Platform subdomain"}
                    {domain.verifiedAt ? ` · verified ${new Date(domain.verifiedAt).toLocaleDateString("en-GB")}` : ""}
                  </p>
                  {domain.failureReason ? (
                    <p className="mt-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
                      {domain.failureReason}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {domain.status !== "active" && domain.kind === "custom" ? (
                    <button
                      type="button"
                      className="btn-admin btn-admin-primary !px-2.5 !py-1 !text-[11px]"
                      disabled={pending}
                      onClick={() => run(() => verifyDomainAction({ siteId, domainId: domain.id }))}
                    >
                      Verify now
                    </button>
                  ) : null}
                  {domain.status === "failed" ? (
                    <button
                      type="button"
                      className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                      disabled={pending}
                      onClick={() => run(() => retryDomainAction({ siteId, domainId: domain.id }))}
                    >
                      Retry window
                    </button>
                  ) : null}
                  {canManage && !domain.isPrimary && domain.status === "active" ? (
                    <button
                      type="button"
                      className="btn-admin btn-admin-secondary !px-2.5 !py-1 !text-[11px]"
                      disabled={pending}
                      onClick={() => run(() => makePrimaryDomainAction({ siteId, domainId: domain.id }))}
                    >
                      Make primary
                    </button>
                  ) : null}
                  {canManage && domain.kind === "custom" ? (
                    <button
                      type="button"
                      className="btn-admin btn-admin-danger !px-2.5 !py-1 !text-[11px]"
                      disabled={pending}
                      onClick={() => {
                        if (!window.confirm(`Disconnect ${domain.hostname}? It stops serving immediately.`)) return;
                        run(() => removeDomainAction({ siteId, domainId: domain.id }));
                      }}
                    >
                      Disconnect
                    </button>
                  ) : null}
                </div>
              </div>

              {domain.kind === "custom" && domain.status !== "active" ? (
                <div className="mt-3 rounded-lg border border-line bg-paper/70 px-3.5 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">DNS record to add</p>
                  <dl className="mt-2 grid gap-2 text-[11px] sm:grid-cols-[80px_1fr]">
                    <dt className="text-slate-500">Type</dt>
                    <dd className="font-mono text-ink-900">TXT</dd>
                    <dt className="text-slate-500">Name</dt>
                    <dd className="flex items-center gap-2">
                      <span className="break-all font-mono text-ink-900">{domain.verificationName}</span>
                      <CopyInline value={domain.verificationName} />
                    </dd>
                    <dt className="text-slate-500">Value</dt>
                    <dd className="flex items-center gap-2">
                      <span className="break-all font-mono text-ink-900">{domain.verificationValue}</span>
                      <CopyInline value={domain.verificationValue} />
                    </dd>
                  </dl>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Then point the hostname at the platform with a CNAME. Verification windows last seven days.
                  </p>
                </div>
              ) : null}
            </li>
          ))}
          {domains.length === 0 ? <li className="px-5 py-8 text-center text-sm text-slate-500">No hostnames yet.</li> : null}
        </ul>
      </section>
    </div>
  );
}
