import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface LiveRegionProps {
  readonly assertive?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

export function LiveRegion({
  assertive = false,
  children,
  className,
}: LiveRegionProps) {
  return (
    <div
      aria-live={assertive ? "assertive" : "polite"}
      className={cn(
        "rounded-md border border-border-subtle bg-muted px-3 py-2 text-sm text-ink",
        className,
      )}
      role={assertive ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
