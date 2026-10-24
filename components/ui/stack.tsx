import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  readonly children: ReactNode;
  readonly direction?: "column" | "row";
  readonly gap?: "sm" | "md" | "lg";
  readonly align?: "start" | "center" | "between";
}

const GAP_CLASS: Record<NonNullable<StackProps["gap"]>, string> = {
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

const ALIGN_CLASS: Record<NonNullable<StackProps["align"]>, string> = {
  start: "items-start",
  center: "items-center",
  between: "items-center justify-between",
};

export function Stack({
  align = "start",
  children,
  className,
  direction = "column",
  gap = "md",
  ...rest
}: StackProps) {
  return (
    <div
      className={cn(
        "flex",
        direction === "row" ? "flex-row flex-wrap" : "flex-col",
        GAP_CLASS[gap],
        ALIGN_CLASS[align],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
