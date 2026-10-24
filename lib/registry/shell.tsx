import type { CSSProperties, ReactNode } from "react";
import { lookupMedia } from "@/lib/media/refs";
import type { Appearance } from "./types";

/* ------------------------------------------------------------------ *
 * Section shell — every block gets the same background, spacing, width,
 * alignment and per-device visibility controls.
 * ------------------------------------------------------------------ */

const SPACING: Record<Appearance["spacing"], string> = {
  none: "py-0",
  sm: "py-8",
  md: "py-14",
  lg: "py-20",
  xl: "py-28",
};

const WIDTH: Record<Appearance["width"], string> = {
  narrow: "max-w-[780px]",
  default: "max-w-[1160px]",
  wide: "max-w-[1400px]",
  full: "max-w-none",
};

const BACKGROUNDS: Record<Appearance["background"], CSSProperties | null> = {
  inherit: null,
  transparent: { background: "transparent" },
  surface: { background: "var(--site-surface)" },
  accent: {
    background: "var(--site-accent)",
    color: "var(--site-accent-contrast)",
    ["--site-text" as string]: "var(--site-accent-contrast)",
    ["--site-muted" as string]: "color-mix(in srgb, var(--site-accent-contrast) 72%, transparent)",
    ["--site-surface" as string]: "color-mix(in srgb, var(--site-accent-contrast) 10%, var(--site-accent))",
    ["--site-border" as string]: "color-mix(in srgb, var(--site-accent-contrast) 24%, var(--site-accent))",
  },
  muted: { background: "color-mix(in srgb, var(--site-surface) 55%, var(--site-bg))" },
  dark: {
    background: "#05080f",
    color: "#f4f6fb",
    ["--site-text" as string]: "#f4f6fb",
    ["--site-muted" as string]: "#9aa4bb",
    ["--site-surface" as string]: "#121a2b",
    ["--site-border" as string]: "#243049",
  },
  light: {
    background: "#f5f7fb",
    color: "#0f172a",
    ["--site-text" as string]: "#0f172a",
    ["--site-muted" as string]: "#5b6577",
    ["--site-surface" as string]: "#ffffff",
    ["--site-border" as string]: "#dbe1ec",
  },
};

const VISIBILITY: Record<Appearance["visibility"], string> = {
  all: "",
  desktop: "hidden md:block",
  mobile: "md:hidden",
};

export function Section({
  appearance,
  children,
  className = "",
  as: Tag = "section",
}: {
  appearance?: Partial<Appearance>;
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "header" | "footer" | "nav";
}) {
  const a: Appearance = {
    background: appearance?.background ?? "inherit",
    spacing: appearance?.spacing ?? "md",
    width: appearance?.width ?? "default",
    align: appearance?.align ?? "left",
    visibility: appearance?.visibility ?? "all",
    anchor: appearance?.anchor ?? "",
  };
  const bgStyle = BACKGROUNDS[a.background];
  return (
    <Tag
      id={a.anchor || undefined}
      data-block-section=""
      className={`${SPACING[a.spacing]} ${VISIBILITY[a.visibility]} ${className}`}
      style={bgStyle ?? undefined}
    >
      <div
        className={`mx-auto ${WIDTH[a.width]} px-5 sm:px-8 ${
          a.align === "center" ? "text-center" : ""
        }`}
      >
        {children}
      </div>
    </Tag>
  );
}

/* ------------------------------------------------------------------ *
 * Small shared pieces
 * ------------------------------------------------------------------ */

export type LinkValue = { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };

export function ButtonLink({
  link,
  className = "",
  size = "md",
}: {
  link: LinkValue | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  if (!link || !link.label) return null;
  const variant = link.style ?? "solid";
  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-2.5 text-[15px]",
    lg: "px-7 py-3.5 text-base",
  } as const;
  return (
    <a
      href={link.href || "#"}
      className={`btn btn-${variant} ${sizes[size]} ${className}`}
      data-tracking-placement={link.label ? link.label.toLowerCase().replace(/\s+/g, "-") : undefined}
    >
      {link.label}
    </a>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="eyebrow">{children}</p>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  align?: "left" | "center";
}) {
  if (!eyebrow && !title && !description) return null;
  return (
    <div className={`mb-10 ${align === "center" ? "text-center mx-auto max-w-2xl" : "max-w-2xl"}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      {title ? (
        <h2 className="font-heading text-3xl sm:text-4xl leading-tight tracking-tight text-[color:var(--site-text)]">
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="mt-3 text-base leading-relaxed text-[color:var(--site-muted)]">{description}</p>
      ) : null}
    </div>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const rounded = Math.round(Math.max(0, Math.min(5, rating)) * 2) / 2;
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
            <defs>
              <linearGradient id={`half-${i}-${size}`}>
                <stop offset="50%" stopColor="var(--site-accent)" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path
              d="M10 1.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.6 7.7l5.8-.8z"
              fill={fill === 1 ? "var(--site-accent)" : fill === 0.5 ? `url(#half-${i}-${size})` : "none"}
              stroke="var(--site-accent)"
              strokeWidth="1.2"
            />
          </svg>
        );
      })}
    </span>
  );
}

const GLYPHS: Record<string, string> = {
  bolt: "M13 2 4.5 13.2h5.2L9 22l8.6-11.4h-5.3z",
  gift: "M20 8h-2.2a3.4 3.4 0 0 0-1.5-4.6 3.3 3.3 0 0 0-4.6 1.4L10 8 8.3 4.8A3.3 3.3 0 0 0 3.7 3.4a3.4 3.4 0 0 0-1.5 4.6H0v4h20zM2 14h7v8H4a2 2 0 0 1-2-2zm9 0h7v6a2 2 0 0 1-2 2h-5z",
  trophy:
    "M7 3h10v3h3v3a4 4 0 0 1-4 4h-.5A5.5 5.5 0 0 1 13 15.8V18h3v3H8v-3h3v-2.2A5.5 5.5 0 0 1 8.5 13H8a4 4 0 0 1-4-4V6h3zm0 5H6v1a2 2 0 0 0 1 1.7zm10 0v2.7A2 2 0 0 0 18 9V8zM9 5v6h2a3 3 0 0 0 3-3V5z",
  wallet:
    "M3 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1h1.5A1.5 1.5 0 0 1 22 8.5v8A1.5 1.5 0 0 1 20.5 18H5a2 2 0 0 1-2-2zm13.5 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3",
  shield: "M12 2l8 3v6c0 5-3.4 9.2-8 11-4.6-1.8-8-6-8-11V5zm-1 13 5-5-1.4-1.4L11 12.2 8.9 10 7.5 11.4z",
  star: "M12 2l3.1 6.3 6.9.9-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-.9z",
  check: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m-1.2 14.2-4-4 1.5-1.5 2.5 2.5 5.4-5.4 1.5 1.5z",
  card: "M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2H2zm0 4h20v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z",
  lock: "M6 10V8a6 6 0 1 1 12 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h8V8a4 4 0 1 0-8 0z",
  chat: "M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4V5a2 2 0 0 1 2-2",
  spark: "M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8zM19 16l.9 2.1L22 19l-2.1.9L19 22l-.9-2.1L16 19l2.1-.9z",
  users:
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8m7 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 20a7 7 0 0 1 14 0zm15 0a6 6 0 0 0-2.6-4.9A5 5 0 0 1 22 20z",
  clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20m1 5v5.4l4 2.4-1 1.7-5-3V7z",
  arrow: "M13 5l7 7-7 7-1.4-1.4L16.2 13H4v-2h12.2L11.6 6.4z",
};

export function Glyph({
  name,
  size = 20,
  className = "",
}: {
  name?: string;
  size?: number;
  className?: string;
}) {
  const path = GLYPHS[name ?? ""] ?? GLYPHS.spark;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

export const GLYPH_OPTIONS = Object.keys(GLYPHS).map((key) => ({
  label: key[0].toUpperCase() + key.slice(1),
  value: key,
}));

/** Safe rich text: a tiny markdown subset rendered as React nodes, never HTML. */
export function RichText({ text, className = "" }: { text?: string; className?: string }) {
  if (!text) return null;
  const blocks = text.split(/\n{2,}/);
  return (
    <div className={`rich-text ${className}`}>
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("### ")) return <h4 key={index}>{inline(trimmed.slice(4))}</h4>;
        if (trimmed.startsWith("## ")) return <h3 key={index}>{inline(trimmed.slice(3))}</h3>;
        if (/^[-*] /.test(trimmed)) {
          const items = trimmed.split(/\n/).map((line) => line.replace(/^[-*] /, ""));
          return (
            <ul key={index}>
              {items.map((item, i) => (
                <li key={i}>{inline(item)}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{inline(trimmed.replace(/\n/g, " "))}</p>;
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    else if (token.startsWith("*")) nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    else {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (linkMatch) {
        nodes.push(
          <a key={key++} href={linkMatch[2]}>
            {linkMatch[1]}
          </a>,
        );
      }
    }
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function MediaImage({
  value,
  alt,
  className = "",
  rounded = true,
  fallbackLabel,
}: {
  value: { id: string; url?: string; alt?: string } | null | undefined;
  alt?: string;
  className?: string;
  rounded?: boolean;
  fallbackLabel?: string;
}) {
  const media = lookupMedia(value);
  const label = alt || media?.alt || fallbackLabel || "";
  if (!media?.url) {
    return (
      <div
        className={`media-placeholder ${rounded ? "rounded-[var(--site-radius-md)]" : ""} ${className}`}
        role="img"
        aria-label={label || "Image not chosen"}
      >
        <span>{label || "Choose an image"}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media.url}
      alt={label}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading="lazy"
      className={`${rounded ? "rounded-[var(--site-radius-md)]" : ""} ${className}`}
    />
  );
}
