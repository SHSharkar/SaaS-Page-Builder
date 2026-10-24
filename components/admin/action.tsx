"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";

export type ActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  inviteUrl?: string;
  id?: string;
  references?: string[];
};

export function Notice({ state, className = "" }: { state: ActionResult | null; className?: string }) {
  if (!state || (!state.error && !state.message)) return null;
  const tone = state.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-700";
  return (
    <div role="status" className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${tone} ${className}`}>
      {state.error ?? state.message}
    </div>
  );
}

export function ActionButton({
  action,
  payload,
  children,
  pendingLabel = "Working…",
  className = "btn-admin btn-admin-secondary",
  confirm,
  onDone,
}: {
  action: (payload: never) => Promise<ActionResult>;
  payload: Record<string, unknown>;
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  confirm?: string;
  onDone?: (state: ActionResult) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionResult | null>(null);

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={pending}
        className={className}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          startTransition(async () => {
            const next = await action(payload as never);
            setState(next);
            onDone?.(next);
          });
        }}
      >
        {pending ? pendingLabel : children}
      </button>
      <Notice state={state} />
    </span>
  );
}

export function ActionForm({
  action,
  children,
  submitLabel,
  className = "space-y-3",
  extra,
}: {
  action: (state: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel: string;
  className?: string;
  extra?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-2">
        <button type="submit" className="btn-admin btn-admin-primary" disabled={pending}>
          {pending ? "Working…" : submitLabel}
        </button>
        {extra}
      </div>
      <Notice state={state} />
      {state?.inviteUrl ? (
        <p className="rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[11px] break-all text-slate-600">
          {typeof window !== "undefined" ? window.location.origin : ""}
          {state.inviteUrl}
        </p>
      ) : null}
    </form>
  );
}

export function CopyInline({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rounded-md border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-paper"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : label}
    </button>
  );
}
