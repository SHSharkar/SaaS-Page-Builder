"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInAction, type FormState } from "@/lib/actions/auth";

const initial: FormState = {};

export function SignInForm({
  demo,
  next,
}: {
  demo: { email: string; password: string }[];
  next?: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(signInAction, initial);

  // The password was right but a TOTP code is still owed: Better Auth keeps the
  // half-signed-in session in a cookie and the code screen finishes it.
  useEffect(() => {
    if (state.twoFactor) {
      router.push(`/sign-in/two-factor${next ? `?next=${encodeURIComponent(next)}` : ""}`);
    }
  }, [state.twoFactor, next, router]);

  return (
    <form action={action} className="space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div>
        <label className="label" htmlFor="email">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="input"
          placeholder="you@trofeo.example"
          defaultValue={demo[0]?.email}
        />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="password">
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
          className="input"
          placeholder="••••••••••"
          defaultValue={demo[0]?.password}
        />
      </div>

      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="btn-admin btn-admin-primary w-full" disabled={pending}>
        {pending ? "Checking…" : "Sign in"}
      </button>

      <div className="rounded-lg border border-line bg-paper/60 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          Demo accounts
        </p>
        <ul className="mt-2 space-y-1 text-[12px] text-slate-600">
          {demo.map((account) => (
            <li key={account.email} className="flex items-center justify-between gap-2">
              <span className="font-medium">{account.email}</span>
              <span className="text-slate-400">{account.password}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">
          All three share the same password in this stage environment.
        </p>
      </div>
    </form>
  );
}
