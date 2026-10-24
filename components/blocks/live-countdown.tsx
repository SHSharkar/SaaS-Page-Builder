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
    return <p className="text-sm text-[color:var(--site-muted)]">Set a target date to start the timer.</p>;
  }

  if (expired) {
    return <p className="text-sm font-medium text-[color:var(--site-muted)]">{expiredMessage}</p>;
  }

  const units = [
    { key: "days", label: labels[0] ?? "Days" },
    { key: "hours", label: labels[1] ?? "Hours" },
    { key: "minutes", label: labels[2] ?? "Minutes" },
    { key: "seconds", label: labels[3] ?? "Seconds" },
  ] as const;

  return (
    <div className="flex items-center gap-2" role="timer" aria-live="off">
      {units.map((unit, index) => (
        <div key={unit.key} className="flex items-center gap-2">
          <div
            className="min-w-[62px] rounded-[var(--site-radius-sm)] border px-3 py-2 text-center"
            style={{ borderColor: "var(--site-border)", background: "var(--site-bg)" }}
          >
            <p className="font-heading text-xl leading-none tabular-nums" style={{ color: "var(--site-text)" }}>
              {remaining ? remaining[unit.key] : "--"}
            </p>
            <p className="mt-1 text-[10px] uppercase tracking-[0.12em]" style={{ color: "var(--site-muted)" }}>
              {unit.label}
            </p>
          </div>
          {index < units.length - 1 ? (
            <span aria-hidden="true" style={{ color: "var(--site-muted)" }}>
              :
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
