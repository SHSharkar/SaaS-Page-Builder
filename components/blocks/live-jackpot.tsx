"use client";

import { useEffect, useState } from "react";

export function LiveJackpot({
  start,
  currency = "$",
  step = 3,
  label,
}: {
  start: number;
  currency?: string;
  step?: number;
  label?: string;
}) {
  const [value, setValue] = useState(start);

  useEffect(() => {
    const timer = setInterval(() => setValue((current) => current + step * (1 + Math.random() * 1.4)), 1400);
    return () => clearInterval(timer);
  }, [step]);

  const formatted = Math.round(value).toLocaleString("en-US");

  return (
    <div className="text-center">
      {label ? <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[color:var(--site-muted)]">{label}</p> : null}
      <p
        className="mt-2 font-heading text-4xl tabular-nums tracking-tight sm:text-5xl"
        style={{ color: "var(--site-accent)" }}
        aria-live="off"
      >
        {currency}
        {formatted}
      </p>
    </div>
  );
}
