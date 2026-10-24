"use client";

import Link from "next/link";
import { useActionState } from "react";
import { completePasswordResetAction, type FormState } from "@/lib/actions/auth";
import {
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

const initial: FormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(completePasswordResetAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className={adminLabelClass} htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          maxLength={128}
          autoComplete="new-password"
          className={adminInputClass}
          placeholder="At least 10 characters, letters and numbers"
        />
      </div>
      <div>
        <label className={adminLabelClass} htmlFor="confirm">
          Repeat the new password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={10}
          maxLength={128}
          className={adminInputClass}
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
      {state.ok ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {state.message}
          </p>
          <Link
            href="/sign-in"
            className={`${adminButtonVariants({ tone: "primary" })} block w-full text-center`}
          >
            Go to sign-in
          </Link>
        </div>
      ) : null}
      <button
        type="submit"
        className={`${adminButtonVariants({ tone: "primary" })} w-full`}
        disabled={pending}
      >
        {pending ? "Saving..." : "Set the password"}
      </button>
    </form>
  );
}
