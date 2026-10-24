"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { removeOwnPasskeyAction } from "@/lib/actions/account";

type PasskeyRow = { id: string; name: string | null; createdAt: string; deviceType: string; backedUp: boolean };

export function PasskeyManager({ passkeys }: { passkeys: PasskeyRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();

  const register = async () => {
    setBusy(true);
    setError(null);
    const result = await authClient.passkey.addPasskey({ name: name.trim() || undefined });
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "The passkey could not be registered.");
      return;
    }
    setName("");
    router.refresh();
  };

  const remove = (id: string) =>
    startTransition(async () => {
      const result = await removeOwnPasskeyAction({ passkeyId: id });
      if (!result.ok) setError(result.error ?? "The passkey could not be removed.");
      else router.refresh();
    });

  return (
    <div className="space-y-3">
      <ul className="space-y-1.5">
        {passkeys.length === 0 ? (
          <li className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12px] text-slate-500">
            No passkeys yet. Add one to sign in without typing a password.
          </li>
        ) : (
          passkeys.map((passkey) => (
            <li
              key={passkey.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2"
            >
              <div>
                <p className="text-[13px] font-medium text-ink-900">{passkey.name || "Unnamed passkey"}</p>
                <p className="text-[11px] text-slate-400">
                  {passkey.deviceType}
                  {passkey.backedUp ? " · synced" : ""} · added{" "}
                  {new Date(passkey.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                type="button"
                className="text-[11px] text-slate-500 underline hover:text-red-600"
                disabled={pending}
                onClick={() => remove(passkey.id)}
              >
                Remove
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <label className="label" htmlFor="passkey-name">
            Name this device
          </label>
          <input
            id="passkey-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="MacBook, phone, security key"
          />
        </div>
        <button
          type="button"
          className="btn-admin btn-admin-primary"
          disabled={busy}
          onClick={register}
        >
          {busy ? "Follow your device…" : "Add a passkey"}
        </button>
      </div>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
