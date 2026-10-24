import type { FormHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  readonly children: ReactNode;
}

export function Form({ children, className, ...rest }: FormProps) {
  return (
    <form className={cn("flex flex-col gap-4", className)} {...rest}>
      {children}
    </form>
  );
}
