"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stepUpAction, type FormState } from "@/lib/actions/auth";

export function StepUpNotice({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<FormState | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <form
      className={`rounded-lg border border-amber-200 bg-amber-50 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
      action={async (formData) => {
        setPending(true);
        const result = await stepUpAction({}, formData);
        setPending(false);
        setState(result);
        if (result.ok) router.refresh();
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[12px] text-amber-900">
          Sensitive changes need a fresh confirmation. Enter your password to unlock a ten-minute window.
        </p>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="Your password"
          className="input !w-44 !py-1 !text-[12px]"
        />
        <button type="submit" className="btn-admin btn-admin-secondary !py-1 !text-[11px]" disabled={pending}>
          {pending ? "Checking…" : "Confirm"}
        </button>
      </div>
      {state?.error ? <p className="mt-1.5 text-[11px] text-red-700">{state.error}</p> : null}
      {state?.ok ? <p className="mt-1.5 text-[11px] text-green-800">{state.message}</p> : null}
    </form>
  );
}
