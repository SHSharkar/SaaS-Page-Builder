"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changePasswordAction, type FormState } from "@/lib/actions/auth";
import {
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

const initial: FormState = {};

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={adminLabelClass} htmlFor="current">
          {forced ? "Temporary password you were given" : "Current password"}
        </label>
        <input
          id="current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className={adminInputClass}
        />
      </div>
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
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        className={`${adminButtonVariants({ tone: "primary" })} w-full`}
        disabled={pending}
      >
        {pending ? "Saving..." : forced ? "Save and continue" : "Change password"}
      </button>
      {state.ok && forced ? (
        <Link
          href="/admin"
          className="block text-center text-[12px] font-medium text-slate-950 underline"
        >
          Continue to the dashboard
        </Link>
      ) : null}
    </form>
  );
}
