import { cva } from "class-variance-authority";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly children: ReactNode;
  readonly variant?: "primary" | "secondary" | "danger";
}

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-accent text-on-accent",
        secondary: "border border-border-subtle bg-card text-ink",
        danger: "bg-danger text-on-accent",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export function Button({
  children,
  className,
  type = "button",
  variant = "primary",
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant }), className)}
      type={type}
      {...rest}
    >
      {children}
    </button>
  );
}
