"use client";

import { useActionState } from "react";
import Link from "next/link";
import { verifyTwoFactorAction, type FormState } from "@/lib/actions/auth";

const initial: FormState = {};

export function TwoFactorForm({ next }: { next?: string | null }) {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, initial);

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label className="label" htmlFor="code">
          Authentication code
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          required
          autoFocus
          className="input text-center text-lg tracking-[0.4em]"
          placeholder="000000"
        />
      </div>
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn-admin btn-admin-primary w-full" disabled={pending}>
        {pending ? "Verifying…" : "Verify and continue"}
      </button>
      <p className="text-center text-xs text-slate-500">
        Wrong device?{" "}
        <Link href="/sign-in" className="font-medium text-ink-900 underline">
          Start again
        </Link>
      </p>
    </form>
  );
}
