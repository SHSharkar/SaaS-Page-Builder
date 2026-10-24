import type { FieldsetHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FieldsetProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  readonly children: ReactNode;
  readonly legend: string;
}

export function Fieldset({
  children,
  className,
  legend,
  ...rest
}: FieldsetProps) {
  return (
    <fieldset
      className={cn("rounded-md border border-border-subtle p-4", className)}
      {...rest}
    >
      <legend className="px-2 text-sm font-medium text-ink">{legend}</legend>
      {children}
    </fieldset>
  );
}
