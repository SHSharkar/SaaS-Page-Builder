import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly tone?: "canvas" | "card" | "muted" | "accent";
  readonly padded?: boolean;
  readonly bordered?: boolean;
}

const TONE_CLASS: Record<NonNullable<SurfaceProps["tone"]>, string> = {
  canvas: "bg-canvas text-ink",
  card: "bg-card text-ink",
  muted: "bg-muted text-ink",
  accent: "bg-accent text-on-accent",
};

export function Surface({
  bordered = true,
  children,
  className,
  padded = true,
  tone = "card",
  ...rest
}: SurfaceProps) {
  return (
    <div
      className={cn(
        "rounded-lg",
        TONE_CLASS[tone],
        bordered && "border border-border-subtle",
        padded && "p-6",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
