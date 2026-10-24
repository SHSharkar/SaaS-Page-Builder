"use client";

import { useState } from "react";
import { Glyph } from "@/lib/registry/shell";
import { cn, siteButton } from "@/lib/theme-classes";

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
      <div className="mb-8 flex justify-center">
        <div
          className="inline-flex rounded-full border border-site-border bg-site-surface p-1"
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
              className={cn(
                "cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                cycle === value
                  ? "bg-site-accent text-site-accent-contrast"
                  : "text-site-muted hover:text-site-text",
              )}
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
              className={cn(
                "flex flex-col rounded-site-lg border p-6",
                featured
                  ? "border-site-accent bg-site-surface shadow-lg"
                  : "border-site-border bg-site-surface",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-heading text-lg text-site-text">{plan.name}</p>
                {featured ? (
                  <span className="rounded bg-site-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-site-accent-contrast">
                    Popular
                  </span>
                ) : null}
              </div>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="font-heading text-4xl leading-none tracking-tight text-site-text">
                  {cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                </span>
                <span className="text-sm text-site-muted">{plan.period}</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-site-muted">
                {plan.features
                  .split("\n")
                  .map((feature) => feature.trim())
                  .filter(Boolean)
                  .map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Glyph name="check" size={14} className="mt-0.5 shrink-0 text-site-accent" />
                      <span>{feature}</span>
                    </li>
                  ))}
              </ul>
              <a
                href={plan.ctaHref || "#"}
                className={cn(
                  siteButton({ variant: featured ? "solid" : "outline", size: "md" }),
                  "mt-6 w-full justify-center",
                )}
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
