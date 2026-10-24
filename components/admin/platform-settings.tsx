"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearCacheAction, runWorkerTickAction, updatePlatformSettingAction } from "@/lib/actions/settings";
import type { ActionResult } from "./action";
import { Notice } from "./action";

type Setting = { key: string; value: string; isSecret: boolean; updatedAt: string };

export function PlatformSettings({ settings }: { settings: Setting[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  );
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-5">
      <Notice state={state} />

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Runtime settings</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Resolution order is database, then environment, then default. Secrets are stored encrypted and never shown.
          </p>
        </div>
        <ul className="divide-y divide-line">
          {settings.map((setting) => (
            <li key={setting.key} className="flex flex-wrap items-end justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-mono text-[12px] text-ink-900">{setting.key}</p>
                <p className="text-[11px] text-slate-400">Changed {new Date(setting.updatedAt).toLocaleString("en-GB")}</p>
              </div>
              <div className="flex items-end gap-2">
                <input
                  className="input w-48 !py-1.5 !text-xs"
                  value={draft[setting.key] ?? ""}
                  disabled={setting.isSecret}
                  onChange={(event) => setDraft((current) => ({ ...current, [setting.key]: event.target.value }))}
                  aria-label={setting.key}
                />
                <button
                  type="button"
                  className="btn-admin btn-admin-secondary !px-2.5 !py-1.5 !text-[11px]"
                  disabled={pending || setting.isSecret}
                  onClick={() =>
                    startTransition(async () => {
                      const result = await updatePlatformSettingAction({
                        key: setting.key,
                        value: draft[setting.key] ?? "",
                      });
                      setState(result);
                      router.refresh();
                    })
                  }
                >
                  Save
                </button>
              </div>
            </li>
          ))}
          {settings.length === 0 ? (
            <li className="px-5 py-6 text-center text-sm text-slate-500">No rows — defaults are in force.</li>
          ) : null}
        </ul>
      </section>

      <section className="panel">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink-900">Worker and cache</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            In production the worker runs on a schedule. Here you can run one tick by hand to see jobs drain.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 p-5">
          <button
            type="button"
            className="btn-admin btn-admin-primary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setState(await runWorkerTickAction());
                router.refresh();
              })
            }
          >
            {pending ? "Running…" : "Run one worker tick"}
          </button>
          <button
            type="button"
            className="btn-admin btn-admin-secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setState(await clearCacheAction());
              })
            }
          >
            Clear response cache
          </button>
        </div>
      </section>
    </div>
  );
}
