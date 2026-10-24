"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function PasskeySignInButton({ next }: { next?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const result = await authClient.signIn.passkey();
    setBusy(false);
    if (result.error) {
      setError(result.error.message ?? "That passkey was not accepted.");
      return;
    }
    router.push(next ?? "/admin");
    router.refresh();
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
      >
        {busy ? "Waiting for your device..." : "Sign in with a passkey"}
      </button>
      {error ? <p className="text-[11px] text-red-600">{error}</p> : null}
    </div>
  );
}
