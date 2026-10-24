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
import { StatusBadge } from "@/components/admin/ui";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { CopyInline, Notice, type ActionResult } from "@/components/admin/action";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

type DomainRow = {
  id: string;
  hostname: string;
  kind: string;
  status: string;
  isPrimary: boolean;
  verificationToken: string | null;
  lastError: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  removedAt?: string | null;
};

export function DomainsManager({
  siteId,
  domains,
  canManage,
  canVerify,
  verificationPrefix,
}: {
  siteId: string;
  domains: DomainRow[];
  canManage: boolean;
  canVerify: boolean;
  verificationPrefix: string;
}) {
  const router = useRouter();
  const [hostname, setHostname] = useState("");
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmDomain, setConfirmDomain] = useState<DomainRow | null>(null);

  const run = (fn: () => Promise<ActionResult>) => {
    startTransition(async () => {
      const next = await fn();
      setState(next);
      if (next.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      {canManage ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!hostname.trim()) return;
            run(async () => {
              const res = await addDomainAction({ siteId, hostname });
              if (res.ok) setHostname("");
              return res;
            });
          }}
        >
          <div className="min-w-60 flex-1">
            <label className={adminLabelClass} htmlFor="hostname">
              Custom hostname
            </label>
            <input
              id="hostname"
              className={adminInputClass}
              placeholder="www.brand.example"
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
            />
          </div>
          <button
            type="submit"
            className={adminButtonVariants({ tone: "primary" })}
            disabled={pending}
          >
            {pending ? "Adding..." : "Add hostname"}
          </button>
        </form>
      ) : null}

      <Notice state={state} />

      <div className="space-y-3">
        {domains.map((domain) => {
          const txtName = domain.verificationToken
            ? `_trofeo-verify.${domain.hostname}`
            : null;
          const txtValue = domain.verificationToken
            ? `${verificationPrefix}${domain.verificationToken}`
            : null;

          return (
            <div key={domain.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-slate-950">
                      {domain.hostname}
                    </span>
                    <StatusBadge status={domain.status} />
                    {domain.isPrimary ? (
                      <span className={adminBadgeVariants({ tone: "blue" })}>primary</span>
                    ) : null}
                    <span className="text-[11px] text-slate-400">
                      {domain.kind === "platform_subdomain"
                        ? "built-in subdomain"
                        : "custom domain"}
                    </span>
                  </div>
                  {domain.lastError ? (
                    <p className="mt-1.5 text-xs text-red-600">{domain.lastError}</p>
                  ) : null}
                  {domain.verifiedAt ? (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Verified{" "}
                      {new Date(domain.verifiedAt).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canVerify && (domain.status === "pending" || domain.status === "verifying") ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={adminButtonVariants({ tone: "primary", size: "sm" })}
                      onClick={() => run(() => verifyDomainAction({ siteId, domainId: domain.id }))}
                    >
                      Check DNS
                    </button>
                  ) : null}
                  {canVerify && domain.status === "failed" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                      onClick={() => run(() => retryDomainAction({ siteId, domainId: domain.id }))}
                    >
                      Retry window
                    </button>
                  ) : null}
                  {canManage && domain.status === "active" && !domain.isPrimary ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                      onClick={() =>
                        run(() => makePrimaryDomainAction({ siteId, domainId: domain.id }))
                      }
                    >
                      Make primary
                    </button>
                  ) : null}
                  {canManage &&
                  domain.kind !== "platform_subdomain" &&
                  domain.status !== "removed" ? (
                    <button
                      type="button"
                      disabled={pending}
                      className={adminButtonVariants({ tone: "danger", size: "sm" })}
                      onClick={() => setConfirmDomain(domain)}
                    >
                      Disconnect
                    </button>
                  ) : null}
                </div>
              </div>

              {domain.kind === "custom" && domain.status !== "active" && txtName && txtValue ? (
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="font-semibold text-slate-800">
                    Publish these DNS records with your registrar
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div className="rounded border border-slate-200 bg-white p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">
                          TXT record name
                        </span>
                        <CopyInline value={txtName} />
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-900">
                        {txtName}
                      </p>
                    </div>
                    <div className="rounded border border-slate-200 bg-white p-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-500">
                          TXT record value
                        </span>
                        <CopyInline value={txtValue} />
                      </div>
                      <p className="mt-1 break-all font-mono text-[11px] text-slate-900">
                        {txtValue}
                      </p>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">
                    Also point an A or CNAME record for{" "}
                    <span className="font-mono">{domain.hostname}</span> at the edge ingress
                    address. TLS certificates are issued only after verification succeeds.
                  </p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={confirmDomain !== null}
        title="Disconnect hostname"
        description={
          confirmDomain
            ? `Disconnect ${confirmDomain.hostname}? Visitors using this hostname will stop seeing the site immediately.`
            : ""
        }
        confirmLabel="Disconnect"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmDomain(null)}
        onConfirm={() => {
          if (!confirmDomain) return;
          const targetId = confirmDomain.id;
          setConfirmDomain(null);
          run(() => removeDomainAction({ siteId, domainId: targetId }));
        }}
      />
    </div>
  );
}
