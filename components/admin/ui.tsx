import type { ReactNode } from "react";
import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  breadcrumb,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}) {
  return (
    <header className="mb-7">
      {breadcrumb?.length ? (
        <nav className="mb-3 flex items-center gap-1.5 text-[11px] text-slate-400" aria-label="Breadcrumb">
          {breadcrumb.map((crumb, index) => (
            <span key={index} className="flex items-center gap-1.5">
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-slate-600">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-500">{crumb.label}</span>
              )}
              {index < breadcrumb.length - 1 ? <span aria-hidden="true">/</span> : null}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-500">{eyebrow}</p>
          ) : null}
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">{title}</h1>
          {description ? <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  footer,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            {title ? <h2 className="text-sm font-semibold text-ink-900">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
      {footer ? <div className="border-t border-line px-5 py-3 text-xs text-slate-500">{footer}</div> : null}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="panel block px-5 py-4 transition hover:border-slate-300">
      {body}
    </Link>
  ) : (
    <div className="panel px-5 py-4">{body}</div>
  );
}

type BadgeTone = "green" | "amber" | "gray" | "blue" | "red";

const TONE: Record<string, BadgeTone> = {
  published: "green",
  active: "green",
  applied: "green",
  accepted: "green",
  ready: "green",
  draft: "amber",
  pending: "amber",
  in_review: "amber",
  verifying: "blue",
  mapped: "blue",
  archived: "gray",
  removed: "gray",
  discarded: "gray",
  retired: "gray",
  suspended: "red",
  failed: "red",
  dead: "red",
  revoked: "red",
  expired: "red",
  deleted: "red",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = TONE[status] ?? "gray";
  return (
    <span className={`badge badge-${tone}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 px-6 py-10 text-center">
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{hint}</p> : null}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "success" | "warning"; children: ReactNode }) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-green-200 bg-green-50 text-green-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  } as const;
  return <div className={`rounded-lg border px-3.5 py-2.5 text-sm ${tones[tone]}`}>{children}</div>;
}

export function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const value = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - value.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return value.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
