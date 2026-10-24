import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface AppLinkProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly href: string;
  readonly variant?: "inline" | "button" | "nav";
}

const VARIANT_CLASS: Record<NonNullable<AppLinkProps["variant"]>, string> = {
  inline: "text-sm font-medium underline underline-offset-4 text-ink",
  button:
    "inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent",
  nav: "rounded-md px-3 py-1.5 text-sm font-medium text-ink hover:bg-muted",
};

export function AppLink({
  children,
  className,
  href,
  variant = "inline",
}: AppLinkProps) {
  return (
    <Link className={cn(VARIANT_CLASS[variant], className)} href={href}>
      {children}
    </Link>
  );
}
