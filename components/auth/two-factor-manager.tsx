"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  beginTwoFactorSetupAction,
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
} from "@/lib/actions/account";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

export function TwoFactorManager({
  enabled,
  requiredByPolicy,
}: {
  enabled: boolean;
  requiredByPolicy?: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const secretParam = totpUri ? new URL(totpUri).searchParams.get("secret") : null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-slate-950">Authenticator app (TOTP)</p>
          <p className="text-[11px] text-slate-500">
            {enabled
              ? "Active on this account."
              : requiredByPolicy
                ? "Platform policy requires two-factor authentication before opening the dashboard."
                : "Add a 6-digit authenticator factor and encrypted recovery codes."}
          </p>
        </div>
        <span className={adminBadgeVariants({ tone: enabled ? "green" : "amber" })}>
          {enabled ? "enabled" : "not enrolled"}
        </span>
      </div>

      {!enabled && !totpUri ? (
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-44 flex-1">
            <label className={adminLabelClass} htmlFor="totp-password">
              Confirm your password
            </label>
            <input
              id="totp-password"
              type="password"
              className={adminInputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Current password"
            />
          </div>
          <button
            type="button"
            disabled={pending || !password}
            className={adminButtonVariants({ tone: "primary" })}
            onClick={() =>
              startTransition(async () => {
                const res = await beginTwoFactorSetupAction({ password });
                if (!res.ok) {
                  setFeedback({ ok: false, text: res.error ?? "Setup failed." });
                  return;
                }
                setTotpUri(res.totpUri ?? null);
                setBackupCodes(res.backupCodes ?? null);
                setPassword("");
                setFeedback({ ok: true, text: res.message ?? "Enter a 6-digit code to finish." });
              })
            }
          >
            {pending ? "Starting..." : "Set up authenticator"}
          </button>
        </div>
      ) : null}

      {totpUri ? (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Setup key
            </p>
            <p className="mt-1 break-all font-mono text-xs text-slate-900">
              {secretParam ?? totpUri}
            </p>
            <p className="mt-1 break-all font-mono text-[10px] text-slate-500">{totpUri}</p>
          </div>
          {backupCodes && backupCodes.length > 0 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Single-use recovery codes (save these now)
              </p>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5 font-mono text-xs text-slate-800">
                {backupCodes.map((b) => (
                  <span key={b} className="rounded border border-slate-200 bg-white px-2 py-1">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-36 flex-1">
              <label className={adminLabelClass} htmlFor="totp-verify-code">
                6-digit authenticator code
              </label>
              <input
                id="totp-verify-code"
                inputMode="numeric"
                className={`${adminInputClass} font-mono`}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
              />
            </div>
            <button
              type="button"
              disabled={pending || code.trim().length < 6}
              className={adminButtonVariants({ tone: "primary" })}
              onClick={() =>
                startTransition(async () => {
                  const res = await confirmTwoFactorSetupAction({ code });
                  if (!res.ok) {
                    setFeedback({ ok: false, text: res.error ?? "Invalid code." });
                    return;
                  }
                  setTotpUri(null);
                  setCode("");
                  setFeedback({ ok: true, text: res.message ?? "Enabled." });
                  router.refresh();
                })
              }
            >
              {pending ? "Verifying..." : "Verify & activate"}
            </button>
          </div>
        </div>
      ) : null}

      {enabled && !requiredByPolicy ? (
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div className="min-w-44 flex-1">
            <label className={adminLabelClass} htmlFor="totp-disable-password">
              Password to turn off 2FA
            </label>
            <input
              id="totp-disable-password"
              type="password"
              className={adminInputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Current password"
            />
          </div>
          <button
            type="button"
            disabled={pending || !password}
            className={adminButtonVariants({ tone: "secondary", size: "sm" })}
            onClick={() =>
              startTransition(async () => {
                const res = await disableTwoFactorAction({ password });
                setPassword("");
                setFeedback({
                  ok: res.ok,
                  text: res.error ?? res.message ?? "",
                });
                if (res.ok) router.refresh();
              })
            }
          >
            Turn off 2FA
          </button>
        </div>
      ) : null}

      {feedback && feedback.text ? (
        <p
          className={`text-xs ${feedback.ok ? "text-emerald-700" : "text-red-600"}`}
          role="status"
        >
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
