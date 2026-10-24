import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TextProps {
  readonly as?: "h1" | "h2" | "h3" | "p" | "span";
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: "primary" | "secondary" | "onAccent";
  readonly variant?: "display" | "heading" | "subheading" | "body" | "caption";
}

const VARIANT_CLASS: Record<NonNullable<TextProps["variant"]>, string> = {
  display: "text-3xl font-bold tracking-tight",
  heading: "text-2xl font-semibold tracking-tight",
  subheading: "text-lg font-semibold",
  body: "text-base leading-relaxed",
  caption: "text-sm",
};

const TONE_CLASS: Record<NonNullable<TextProps["tone"]>, string> = {
  primary: "text-ink",
  secondary: "text-subtle",
  onAccent: "text-on-accent",
};

export function Text({
  as = "p",
  children,
  className,
  tone = "primary",
  variant = "body",
}: TextProps) {
  const Tag = as;
  return (
    <Tag className={cn(VARIANT_CLASS[variant], TONE_CLASS[tone], className)}>
      {children}
    </Tag>
  );
}
