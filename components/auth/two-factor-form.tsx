"use client";

import { useActionState } from "react";
import Link from "next/link";
import { verifyTwoFactorAction, type FormState } from "@/lib/actions/auth";
import {
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

const initial: FormState = {};

export function TwoFactorForm({ next }: { next?: string | null }) {
  const [state, action, pending] = useActionState(verifyTwoFactorAction, initial);

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label className={adminLabelClass} htmlFor="code">
          Authentication or backup code
        </label>
        <input
          id="code"
          name="code"
          autoComplete="one-time-code"
          required
          autoFocus
          className={`${adminInputClass} text-center font-mono text-lg tracking-[0.25em]`}
          placeholder="000000"
        />
      </div>
      {state.error ? (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        className={`${adminButtonVariants({ tone: "primary" })} w-full`}
        disabled={pending}
      >
        {pending ? "Verifying..." : "Verify and continue"}
      </button>
      <p className="text-center text-xs text-slate-500">
        Wrong device?{" "}
        <Link href="/sign-in" className="font-medium text-slate-950 underline">
          Start again
        </Link>
      </p>
    </form>
  );
}
