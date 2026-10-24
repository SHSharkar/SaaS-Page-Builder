"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  clearCacheAction,
  revealPlatformSecretAction,
  runCleanupAction,
  runWorkerTickAction,
  updatePlatformSettingAction,
} from "@/lib/actions/settings";
import { Notice, type ActionResult } from "@/components/admin/action";
import {
  adminBadgeVariants,
  adminButtonVariants,
  adminInputClass,
} from "@/lib/theme-classes";

type SettingRow = {
  key: string;
  value: string;
  description: string;
  isSecret?: boolean;
  hasSecretValue?: boolean;
  updatedAt: string;
};

export function SettingsEditor({
  settings,
  canEdit,
  canOperate,
}: {
  settings: SettingRow[];
  canEdit: boolean;
  canOperate: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      settings.map((setting) => [setting.key, setting.isSecret ? "" : setting.value]),
    ),
  );
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Notice state={state} />

      <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {settings.map((setting) => {
          const isSecret = Boolean(setting.isSecret);
          return (
            <div
              key={setting.key}
              className="grid gap-3 p-4 sm:grid-cols-12 sm:items-center"
            >
              <div className="sm:col-span-6">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-xs font-semibold text-slate-950">{setting.key}</p>
                  {isSecret ? (
                    <span className={adminBadgeVariants({ tone: "amber" })}>
                      {setting.hasSecretValue ? "encrypted secret" : "empty secret"}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{setting.description}</p>
                {isSecret && revealed[setting.key] !== undefined ? (
                  <p className="mt-1 break-all rounded border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[11px] text-amber-950">
                    {revealed[setting.key] || "(empty)"}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
                <input
                  type={isSecret ? "password" : "text"}
                  className={`${adminInputClass} min-w-40 flex-1 font-mono text-xs`}
                  disabled={!canEdit}
                  placeholder={isSecret ? "Enter new secret (step-up required)" : ""}
                  value={values[setting.key] ?? ""}
                  onChange={(event) =>
                    setValues({ ...values, [setting.key]: event.target.value })
                  }
                />
                {canEdit && isSecret && setting.hasSecretValue ? (
                  <button
                    type="button"
                    disabled={pending}
                    className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await revealPlatformSecretAction({ key: setting.key });
                        setState(res);
                        if (res.ok && res.secretValue !== undefined) {
                          setRevealed((prev) => ({
                            ...prev,
                            [setting.key]: res.secretValue ?? "",
                          }));
                        }
                      })
                    }
                  >
                    Reveal
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    disabled={pending}
                    className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await updatePlatformSettingAction({
                          key: setting.key,
                          value: values[setting.key] ?? "",
                          isSecret,
                        });
                        setState(res);
                        if (res.ok) {
                          if (isSecret) {
                            setValues((prev) => ({ ...prev, [setting.key]: "" }));
                            setRevealed((prev) => {
                              const next = { ...prev };
                              delete next[setting.key];
                              return next;
                            });
                          }
                          router.refresh();
                        }
                      })
                    }
                  >
                    Save
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {canOperate ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "secondary" })}
            onClick={() =>
              startTransition(async () => {
                const res = await runWorkerTickAction();
                setState(res);
                router.refresh();
              })
            }
          >
            Run maintenance tick now
          </button>
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "secondary" })}
            onClick={() =>
              startTransition(async () => {
                const res = await runCleanupAction();
                setState(res);
                router.refresh();
              })
            }
          >
            Run daily sweeper now
          </button>
          <button
            type="button"
            disabled={pending}
            className={adminButtonVariants({ tone: "secondary" })}
            onClick={() =>
              startTransition(async () => {
                const res = await clearCacheAction();
                setState(res);
              })
            }
          >
            Flush response cache
          </button>
        </div>
      ) : null}
    </div>
  );
}
