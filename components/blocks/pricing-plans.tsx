"use client";

import { useState } from "react";
import { Glyph } from "@/lib/registry/shell";

type Plan = {
  name: string;
  monthlyPrice: string;
  yearlyPrice: string;
  period: string;
  features: string;
  ctaLabel: string;
  ctaHref: string;
  featured: string;
};

export function PricingPlans({
  plans,
  monthlyLabel,
  yearlyLabel,
}: {
  plans: Plan[];
  monthlyLabel: string;
  yearlyLabel: string;
}) {
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");

  return (
    <div>
      <div className="mb-7 flex justify-center">
        <div
          className="inline-flex rounded-full border p-1"
          style={{ borderColor: "var(--site-border)", background: "var(--site-surface)" }}
          role="group"
          aria-label="Billing period"
        >
          {(
            [
              ["monthly", monthlyLabel],
              ["yearly", yearlyLabel],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setCycle(value)}
              aria-pressed={cycle === value}
              className="rounded-full px-4 py-1.5 text-sm font-medium transition"
              style={
                cycle === value
                  ? { background: "var(--site-accent)", color: "var(--site-accent-contrast)" }
                  : { color: "var(--site-muted)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan, index) => {
          const featured = plan.featured === "yes";
          return (
            <div
              key={index}
              className="flex flex-col rounded-[var(--site-radius-lg)] border p-6"
              style={{
                borderColor: featured
                  ? "color-mix(in srgb, var(--site-accent) 65%, var(--site-border))"
                  : "var(--site-border)",
                background: featured
                  ? "color-mix(in srgb, var(--site-accent) 8%, var(--site-surface))"
                  : "var(--site-surface)",
                boxShadow: featured ? "0 20px 45px -30px color-mix(in srgb, var(--site-accent) 80%, transparent)" : undefined,
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-heading text-lg">{plan.name}</p>
                {featured ? (
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest"
                    style={{ background: "var(--site-accent)", color: "var(--site-accent-contrast)" }}
                  >
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-heading text-4xl leading-none tracking-tight">
                  {cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                </span>
                <span className="text-sm" style={{ color: "var(--site-muted)" }}>
                  {plan.period}
                </span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm" style={{ color: "var(--site-muted)" }}>
                {plan.features
                  .split("\n")
                  .map((feature) => feature.trim())
                  .filter(Boolean)
                  .map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Glyph name="check" size={14} className="mt-0.5 text-[color:var(--site-accent)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
              </ul>
              <a
                href={plan.ctaHref || "#"}
                className={`btn mt-6 w-full justify-center ${featured ? "btn-solid" : "btn-outline"}`}
              >
                {plan.ctaLabel}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
