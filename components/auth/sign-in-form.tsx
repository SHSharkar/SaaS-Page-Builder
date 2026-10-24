"use client";

import { useActionState } from "react";
import { signInAction, type FormState } from "@/lib/actions/auth";
import {
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

const initial: FormState = {};

export function SignInForm({
  demo,
  next,
}: {
  demo: { email: string; password: string }[];
  next?: string | null;
}) {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label className={adminLabelClass} htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className={adminInputClass}
          placeholder="you@trofeo.example"
          defaultValue={demo[0]?.email}
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className={adminLabelClass} htmlFor="password">
            Password
          </label>
          <span className="mb-1.5 text-[11px] text-slate-400">Ask an admin to reset</span>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={adminInputClass}
          placeholder="**********"
          defaultValue={demo[0]?.password}
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
        {pending ? "Checking..." : "Sign in"}
      </button>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Demo accounts
        </p>
        <ul className="mt-2 space-y-1 text-[12px] text-slate-600">
          {demo.map((account) => (
            <li key={account.email} className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{account.email}</span>
              <span className="font-mono text-slate-400">{account.password}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">
          All three share the same password in this local stage environment.
        </p>
      </div>
    </form>
  );
}
