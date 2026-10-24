"use client";

import { useActionState } from "react";
import { completePasswordResetAction, type FormState } from "@/lib/actions/auth";

const initial: FormState = {};

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(completePasswordResetAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="input"
          placeholder="At least 10 characters, letters and numbers"
        />
      </div>
      <div>
        <label className="label" htmlFor="confirm">
          Repeat the new password
        </label>
        <input id="confirm" name="confirm" type="password" required minLength={10} className="input" />
      </div>
      {state.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <div className="space-y-3">
          <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {state.message}
          </p>
          <a href="/sign-in" className="btn-admin btn-admin-primary block w-full text-center">
            Go to sign-in
          </a>
        </div>
      ) : null}
      <button type="submit" className="btn-admin btn-admin-primary w-full" disabled={pending}>
        {pending ? "Saving…" : "Set the password"}
      </button>
    </form>
  );
}
