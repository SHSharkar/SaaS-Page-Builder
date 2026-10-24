"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revokeOwnSessionAction } from "@/lib/actions/account";

type Row = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  current: boolean;
};

function when(value: string): string {
  return new Date(value).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function SessionList({ sessions }: { sessions: Row[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      <ul className="divide-y divide-line rounded-lg border border-line bg-white">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-start justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium text-ink-900">
                {session.current ? "This device" : (session.userAgent ?? "Unknown device").slice(0, 60)}
              </p>
              <p className="text-[10px] text-slate-400">
                {session.ipAddress ?? "no address"} · started {when(session.createdAt)} · expires {when(session.expiresAt)}
              </p>
            </div>
            {session.current ? (
              <span className="badge badge-green">current</span>
            ) : (
              <button
                type="button"
                className="text-[11px] text-slate-500 underline hover:text-red-600"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeOwnSessionAction({ sessionId: session.id });
                    setMessage(result.error ?? result.message ?? null);
                    router.refresh();
                  })
                }
              >
                Sign out
              </button>
            )}
          </li>
        ))}
      </ul>
      {message ? <p className="text-[11px] text-slate-500">{message}</p> : null}
    </div>
  );
}
