"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import { adminButtonVariants } from "@/lib/theme-classes";
import { ConfirmModal } from "./confirm-modal";

export type ActionResult = {
  ok: boolean;
  error?: string;
  message?: string;
  inviteUrl?: string;
  resetUrl?: string;
  id?: string;
  references?: string[];
};

export function Notice({
  state,
  className = "",
}: {
  state: ActionResult | null;
  className?: string;
}) {
  if (!state || (!state.error && !state.message)) return null;
  const tone = state.ok
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-red-200 bg-red-50 text-red-700";
  return (
    <div
      role="status"
      className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${tone} ${className}`}
    >
      {state.error ?? state.message}
    </div>
  );
}

export function ActionButton({
  action,
  payload,
  children,
  pendingLabel = "Working...",
  className,
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
  const [modalOpen, setModalOpen] = useState(false);

  const execute = () => {
    setModalOpen(false);
    startTransition(async () => {
      const next = await action(payload as never);
      setState(next);
      onDone?.(next);
    });
  };

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        disabled={pending}
        className={className ?? adminButtonVariants({ tone: "secondary", size: "sm" })}
        onClick={() => {
          if (confirm) {
            setModalOpen(true);
            return;
          }
          execute();
        }}
      >
        {pending ? pendingLabel : children}
      </button>
      <ConfirmModal
        open={modalOpen}
        title="Please confirm"
        description={confirm ?? ""}
        tone="primary"
        pending={pending}
        onConfirm={execute}
        onCancel={() => setModalOpen(false)}
      />
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
        <button
          type="submit"
          className={adminButtonVariants({ tone: "primary" })}
          disabled={pending}
        >
          {pending ? "Working..." : submitLabel}
        </button>
        {extra}
      </div>
      <Notice state={state} />
      {state?.inviteUrl ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 break-all font-mono text-[11px] text-slate-600">
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
      className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
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
