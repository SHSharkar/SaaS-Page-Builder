"use client";

import { useEffect, useState } from "react";

export function LiveJackpot({
  start,
  currency = "$",
  suffix = "",
  step = 3,
  label,
}: {
  start: number;
  currency?: string;
  suffix?: string;
  step?: number;
  label?: string;
}) {
  const [value, setValue] = useState(start);

  useEffect(() => {
    setValue(start);
  }, [start]);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || step <= 0) return;
    const timer = window.setInterval(
      () => setValue((current) => current + step * (1 + Math.random() * 1.4)),
      1400,
    );
    return () => window.clearInterval(timer);
  }, [step]);

  const formatted = Math.round(value).toLocaleString("en-US");

  return (
    <div className="text-center">
      {label ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-site-muted">
          {label}
        </p>
      ) : null}
      <p
        className="mt-2 font-heading text-4xl tracking-tight text-site-accent tabular-nums sm:text-5xl"
        aria-live="off"
      >
        {currency}
        {formatted}
        {suffix}
      </p>
    </div>
  );
}
