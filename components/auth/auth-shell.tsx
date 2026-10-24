import type { ReactNode } from "react";
import Link from "next/link";

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
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-ink-900 lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(700px 500px at 20% 0%, rgba(200,162,74,0.28), transparent 62%), radial-gradient(600px 500px at 90% 100%, rgba(200,162,74,0.14), transparent 60%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-gold-500 text-base font-black text-ink-900">
              T
            </span>
            <div>
              <p className="text-sm font-semibold tracking-tight">Trofēo Pages</p>
              <p className="text-[11px] text-white/50">Internal page platform</p>
            </div>
          </div>

          <div className="max-w-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">
              One page, one truth
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-[1.08] tracking-tight">
              Build it once, publish it everywhere.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Drag components from the library, publish a snapshot, roll it back in one click. Every
              storefront, every domain, from one panel.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-white/70">
              {[
                "Invite-only staff access, role checked on the server",
                "Draft, publish and rollback on every page",
                "Customer domains with a certificate nobody manages by hand",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="mt-0.5 text-gold-400" aria-hidden="true">
                    <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-1.2 14.2-4-4 1.5-1.5 2.5 2.5 5.4-5.4 1.5 1.5z" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[11px] text-white/40">
            Stage environment · every dependency open source · no subscriptions
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink-900 text-sm font-black text-white">
              T
            </span>
            <p className="text-sm font-semibold text-ink-900">Trofēo Pages</p>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-500">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
          <div className="mt-7">{children}</div>
          {footer ? <div className="mt-8 border-t border-line pt-5 text-xs text-slate-500">{footer}</div> : null}
          <p className="mt-8 text-[11px] text-slate-400">
            <Link href="/" className="hover:text-slate-600">
              View the public site
            </Link>{" "}
            · Accounts are invitation only.
          </p>
        </div>
      </div>
    </div>
  );
}
