"use client";

import { useActionState } from "react";
import { acceptInviteAction, type FormState } from "@/lib/actions/auth";
import {
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

const initial: FormState = {};

export function AcceptInviteForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState(acceptInviteAction, initial);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className={adminLabelClass} htmlFor="invite-email-readonly">
          Email
        </label>
        <input
          id="invite-email-readonly"
          className={`${adminInputClass} bg-slate-50`}
          value={email}
          readOnly
        />
      </div>
      <div>
        <label className={adminLabelClass} htmlFor="name">
          Full name
        </label>
        <input
          id="name"
          name="name"
          required
          className={adminInputClass}
          placeholder="Alex Morgan"
        />
      </div>
      <div>
        <label className={adminLabelClass} htmlFor="password">
          Choose a password
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
          Repeat the password
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
      <button
        type="submit"
        className={`${adminButtonVariants({ tone: "primary" })} w-full`}
        disabled={pending}
      >
        {pending ? "Creating your account..." : "Create account"}
      </button>
    </form>
  );
}
