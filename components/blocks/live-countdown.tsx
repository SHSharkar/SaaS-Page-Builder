"use client";

import { useEffect, useState } from "react";

type Parts = { days: string; hours: string; minutes: string; seconds: string };

function partsFrom(ms: number): Parts {
  const total = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    days: pad(Math.floor(total / 86400)),
    hours: pad(Math.floor((total % 86400) / 3600)),
    minutes: pad(Math.floor((total % 3600) / 60)),
    seconds: pad(total % 60),
  };
}

export function LiveCountdown({
  targetDate,
  expiredMessage,
  labels,
}: {
  targetDate: string;
  expiredMessage: string;
  labels: string[];
}) {
  const target = Date.parse(targetDate);
  const [remaining, setRemaining] = useState<Parts | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const tick = () => {
      const diff = target - Date.now();
      setExpired(diff <= 0);
      setRemaining(partsFrom(diff));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!Number.isFinite(target)) {
    return <p className="text-sm text-site-muted">Set a target date to start the timer.</p>;
  }

  if (expired) {
    return <p className="text-sm font-medium text-site-muted">{expiredMessage}</p>;
  }

  const units = [
    { key: "days", label: labels[0] ?? "Days" },
    { key: "hours", label: labels[1] ?? "Hours" },
    { key: "minutes", label: labels[2] ?? "Minutes" },
    { key: "seconds", label: labels[3] ?? "Seconds" },
  ] as const;

  return (
    <div className="flex flex-wrap items-center gap-2" role="timer" aria-live="off">
      {units.map((unit, index) => (
        <div key={unit.key} className="flex items-center gap-2">
          <div className="min-w-16 rounded-site-sm border border-site-border bg-site-bg px-3 py-2 text-center">
            <p className="font-heading text-xl leading-none text-site-text tabular-nums">
              {remaining ? remaining[unit.key] : "--"}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-site-muted">
              {unit.label}
            </p>
          </div>
          {index < units.length - 1 ? (
            <span aria-hidden="true" className="text-site-muted">
              :
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
