import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-12">
      <div className="relative hidden overflow-hidden bg-slate-950 lg:col-span-6 lg:block xl:col-span-7">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/20 via-slate-950 to-slate-900" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-amber-400 text-base font-black text-slate-950">
              T
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Trofeo Pages</p>
              <p className="text-[11px] text-white/50">Internal page platform</p>
            </div>
          </div>
          <div className="pr-8 xl:pr-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-300">
              One page, one source of truth
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight">
              Build it once, publish it everywhere.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/65">
              Drag components from the catalog, publish an immutable version, and roll back in one
              click across every brand and custom domain.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-white/75">
              {[
                "Invite-only staff access, permission checked on the server",
                "Draft, publish, schedule, and rollback on every page",
                "Custom domains with DNS-gated certificate issuance",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-white/45">
            Self-hosted open-source stack | Zero external subscriptions
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center bg-white px-6 py-12 sm:px-12 lg:col-span-6 xl:col-span-5">
        <div className="w-full sm:w-96">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white">
              T
            </span>
            <p className="text-sm font-semibold text-slate-950">Trofeo Pages</p>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-600">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
          <div className="mt-7">{children}</div>
          {footer ? (
            <div className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-500">
              {footer}
            </div>
          ) : null}
          <p className="mt-8 text-[11px] text-slate-400">
            <Link href="/" className="hover:text-slate-600">
              View the public site
            </Link>{" "}
            | Accounts are invitation only.
          </p>
        </div>
      </div>
    </div>
  );
}
