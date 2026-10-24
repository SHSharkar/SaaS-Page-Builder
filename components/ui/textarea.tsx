import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, rows = 4, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-border-subtle bg-card px-3 py-2 text-sm text-ink",
        className,
      )}
      rows={rows}
      {...rest}
    />
  );
}
