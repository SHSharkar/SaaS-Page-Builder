import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: "neutral" | "accent";
}

export function Badge({ children, className, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "accent"
          ? "bg-accent text-on-accent"
          : "border border-border-subtle bg-muted text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}
