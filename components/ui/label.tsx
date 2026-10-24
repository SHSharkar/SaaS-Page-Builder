import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  readonly children: ReactNode;
}

export function Label({ children, className, ...rest }: LabelProps) {
  return (
    <label
      className={cn("block text-sm font-medium text-ink", className)}
      {...rest}
    >
      {children}
    </label>
  );
}
