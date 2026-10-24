"use client";

import { useActionState } from "react";
import { changePasswordAction, type FormState } from "@/lib/actions/auth";

const initial: FormState = {};

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [state, action, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="current">
          {forced ? "The temporary password you were given" : "Current password"}
        </label>
        <input
          id="current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
          className="input"
        />
      </div>
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
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">{state.message}</p>
      ) : null}
      <button type="submit" className="btn-admin btn-admin-primary w-full" disabled={pending}>
        {pending ? "Saving…" : forced ? "Save and continue" : "Change password"}
      </button>
      {state.ok && forced ? (
        <a href="/admin" className="block text-center text-[12px] font-medium text-ink-900 underline">
          Continue to the dashboard
        </a>
      ) : null}
    </form>
  );
}
