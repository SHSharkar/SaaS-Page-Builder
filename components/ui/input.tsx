import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type SafeInputType =
  "text" | "email" | "password" | "url" | "number" | "search";

export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  readonly type?: SafeInputType;
}

export function Input({ className, type = "text", ...rest }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm text-ink",
        className,
      )}
      type={type}
      {...rest}
    />
  );
}
