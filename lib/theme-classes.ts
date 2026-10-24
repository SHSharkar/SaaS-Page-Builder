import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { cva, type VariantProps } from "class-variance-authority";
import type { SiteTheme } from "@/lib/documents";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const adminButton = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:cursor-not-allowed disabled:opacity-55",
  {
    variants: {
      variant: {
        primary: "border-transparent bg-ink-900 text-white hover:bg-ink-800",
        accent: "border-transparent bg-gold-500 text-ink-900 hover:bg-gold-400",
        secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        danger: "border-red-300 bg-white text-red-700 hover:bg-red-50",
        ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-ink-900",
      },
      tone: {
        primary: "border-transparent bg-ink-900 text-white hover:bg-ink-800",
        accent: "border-transparent bg-gold-500 text-ink-900 hover:bg-gold-400",
        secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
        danger: "border-red-300 bg-white text-red-700 hover:bg-red-50",
        ghost: "border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-ink-900",
      },
      size: {
        xs: "px-2.5 py-1 text-xs",
        sm: "px-3 py-1.5 text-xs",
        md: "px-3.5 py-2 text-sm",
        lg: "px-5 py-2.5 text-sm",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export type AdminButtonVariants = VariantProps<typeof adminButton>;

export const adminBadge = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-tight",
  {
    variants: {
      tone: {
        green: "bg-emerald-50 text-emerald-700",
        amber: "bg-amber-50 text-amber-700",
        gray: "bg-slate-100 text-slate-600",
        blue: "bg-blue-50 text-blue-700",
        red: "bg-red-50 text-red-700",
        neutral: "bg-slate-100 text-slate-600",
        success: "bg-emerald-50 text-emerald-700",
        warning: "bg-amber-50 text-amber-700",
        danger: "bg-red-50 text-red-700",
        info: "bg-blue-50 text-blue-700",
      },
    },
    defaultVariants: {
      tone: "gray",
    },
  },
);

export const ADMIN_PANEL = "rounded-2xl border border-line bg-white";
export const ADMIN_LABEL = "mb-1.5 block text-xs font-semibold text-slate-600";
export const ADMIN_INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/25";
export const ADMIN_SELECT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/25";
export const ADMIN_TEXTAREA =
  "min-h-24 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/25";

export const adminButtonVariants = adminButton;
export const adminBadgeVariants = adminBadge;
export const adminPanelClass = ADMIN_PANEL;
export const adminLabelClass = ADMIN_LABEL;
export const adminInputClass = ADMIN_INPUT;
export const adminSelectClass = ADMIN_SELECT;
export const adminTextareaClass = ADMIN_TEXTAREA;

export const siteButton = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-site-sm border font-semibold leading-tight whitespace-nowrap transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-site-accent",
  {
    variants: {
      variant: {
        solid: "border-transparent bg-site-accent text-site-accent-contrast",
        outline: "border-site-border bg-transparent text-site-text hover:bg-site-surface/60",
        ghost: "border-transparent bg-transparent text-site-text hover:bg-site-surface/60",
        light: "border-transparent bg-site-text text-site-bg",
      },
      size: {
        sm: "px-4 py-2 text-sm",
        md: "px-5 py-2.5 text-[15px]",
        lg: "px-7 py-3.5 text-base",
      },
    },
    defaultVariants: {
      variant: "solid",
      size: "md",
    },
  },
);

export const SITE_EYEBROW = "mb-3 text-[11px] font-bold uppercase tracking-[0.16em] text-site-accent";
export const SITE_CHIP =
  "inline-flex items-center gap-1.5 rounded-full border border-site-border px-2.5 py-1 text-[11px] font-semibold tracking-wide text-site-muted";
export const SITE_CARD = "border-site-border bg-site-surface text-site-text";
export const SITE_MEDIA_PLACEHOLDER =
  "grid min-h-24 place-items-center border border-dashed border-site-border bg-site-surface/70 p-3 text-center text-xs text-site-muted";
export const SITE_CAROUSEL_ARROW =
  "absolute top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-site-border bg-site-bg/80 text-site-text backdrop-blur-sm";

const ACCENT_PRESETS: Record<string, string> = {
  "#c8a24a": "[--color-site-accent:#c8a24a] [--color-site-accent-contrast:#0b1120]",
  "#d9b968": "[--color-site-accent:#d9b968] [--color-site-accent-contrast:#0b1120]",
  "#f59e0b": "[--color-site-accent:#f59e0b] [--color-site-accent-contrast:#0b1120]",
  "#7fb3d5": "[--color-site-accent:#7fb3d5] [--color-site-accent-contrast:#0b1120]",
  "#38bdf8": "[--color-site-accent:#38bdf8] [--color-site-accent-contrast:#0b1120]",
  "#e0a4a4": "[--color-site-accent:#e0a4a4] [--color-site-accent-contrast:#0b1120]",
  "#f43f5e": "[--color-site-accent:#f43f5e] [--color-site-accent-contrast:#ffffff]",
  "#34d399": "[--color-site-accent:#34d399] [--color-site-accent-contrast:#071a12]",
  "#10b981": "[--color-site-accent:#10b981] [--color-site-accent-contrast:#071a12]",
  "#a78bfa": "[--color-site-accent:#a78bfa] [--color-site-accent-contrast:#0f0a1e]",
  "#8b5cf6": "[--color-site-accent:#8b5cf6] [--color-site-accent-contrast:#ffffff]",
  "#2563eb": "[--color-site-accent:#2563eb] [--color-site-accent-contrast:#ffffff]",
};

const ACCENT_DOT_PRESETS: Record<string, string> = {
  "#c8a24a": "bg-[#c8a24a]",
  "#d9b968": "bg-[#d9b968]",
  "#f59e0b": "bg-amber-500",
  "#7fb3d5": "bg-[#7fb3d5]",
  "#38bdf8": "bg-sky-400",
  "#e0a4a4": "bg-[#e0a4a4]",
  "#f43f5e": "bg-rose-500",
  "#34d399": "bg-emerald-400",
  "#10b981": "bg-emerald-500",
  "#a78bfa": "bg-violet-400",
  "#8b5cf6": "bg-violet-500",
  "#2563eb": "bg-blue-600",
};

const SURFACE_PRESETS: Record<string, string> = {
  "#0b1120":
    "[--color-site-bg:#0b1120] [--color-site-surface:#121a2b] [--color-site-text:#f4f6fb] [--color-site-muted:#9aa4bb] [--color-site-border:#243049]",
  "#05080f":
    "[--color-site-bg:#05080f] [--color-site-surface:#0f1728] [--color-site-text:#f4f6fb] [--color-site-muted:#9aa4bb] [--color-site-border:#1f2a44]",
  "#f5f7fb":
    "[--color-site-bg:#f5f7fb] [--color-site-surface:#ffffff] [--color-site-text:#0f172a] [--color-site-muted:#5b6577] [--color-site-border:#dbe1ec]",
  "#ffffff":
    "[--color-site-bg:#ffffff] [--color-site-surface:#f8fafc] [--color-site-text:#0f172a] [--color-site-muted:#475569] [--color-site-border:#e2e8f0]",
};

const RADIUS_PRESETS: Record<SiteTheme["radius"], string> = {
  sharp: "[--radius-site-sm:2px] [--radius-site-md:4px] [--radius-site-lg:6px]",
  soft: "[--radius-site-sm:6px] [--radius-site-md:10px] [--radius-site-lg:16px]",
  round: "[--radius-site-sm:12px] [--radius-site-md:18px] [--radius-site-lg:28px]",
  rounded: "[--radius-site-sm:12px] [--radius-site-md:18px] [--radius-site-lg:28px]",
  pill: "[--radius-site-sm:9999px] [--radius-site-md:20px] [--radius-site-lg:32px]",
};

const HEADING_FONT_PRESETS: Record<string, string> = {
  editorial: "[--font-heading:var(--font-editorial)]",
  modern: "[--font-heading:var(--font-modern)]",
  geometric: "[--font-heading:var(--font-geometric)]",
  mono: "[--font-heading:var(--font-mono)]",
  "system-sans": "[--font-heading:var(--font-sans)]",
};

const BODY_FONT_PRESETS: Record<string, string> = {
  editorial: "font-editorial",
  modern: "font-modern",
  geometric: "font-geometric",
  mono: "font-mono",
  "system-sans": "font-sans",
};

export function siteThemeClasses(theme: SiteTheme, rootBackground = "default"): string {
  const accentKey = (theme.accent ?? "#c8a24a").trim().toLowerCase();
  const bgKey =
    rootBackground === "dark"
      ? "#05080f"
      : (theme.background ?? "#0b1120").trim().toLowerCase();
  return cn(
    "bg-site-bg text-site-text",
    ACCENT_PRESETS[accentKey] ?? ACCENT_PRESETS["#c8a24a"],
    SURFACE_PRESETS[bgKey] ?? SURFACE_PRESETS["#0b1120"],
    RADIUS_PRESETS[theme.radius] ?? RADIUS_PRESETS.soft,
    HEADING_FONT_PRESETS[theme.headingFont] ?? HEADING_FONT_PRESETS.editorial,
    BODY_FONT_PRESETS[theme.bodyFont] ?? BODY_FONT_PRESETS.modern,
    rootBackground === "surface" && "bg-site-surface",
  );
}

export function accentSwatchClass(hex?: string | null): string {
  const key = (hex ?? "#c8a24a").trim().toLowerCase();
  return ACCENT_DOT_PRESETS[key] ?? "bg-gold-500";
}

export const themeRootClasses = siteThemeClasses;

export const THEME_ACCENT_CHOICES: ReadonlyArray<{ hex: string; label: string }> = [
  { hex: "#c8a24a", label: "Trofeo Gold" },
  { hex: "#f59e0b", label: "Amber Glow" },
  { hex: "#7fb3d5", label: "Ice Blue" },
  { hex: "#38bdf8", label: "Sky" },
  { hex: "#e0a4a4", label: "Rose Quartz" },
  { hex: "#f43f5e", label: "Crimson" },
  { hex: "#34d399", label: "Mint" },
  { hex: "#10b981", label: "Emerald" },
  { hex: "#a78bfa", label: "Lavender" },
  { hex: "#2563eb", label: "Royal Blue" },
];

export const THEME_SURFACE_CHOICES: ReadonlyArray<{
  label: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  border: string;
}> = [
  {
    label: "Midnight Ink",
    background: "#0b1120",
    surface: "#121a2b",
    text: "#f4f6fb",
    muted: "#9aa4bb",
    border: "#243049",
  },
  {
    label: "Obsidian",
    background: "#05080f",
    surface: "#0f1728",
    text: "#f4f6fb",
    muted: "#9aa4bb",
    border: "#1f2a44",
  },
  {
    label: "Soft Paper",
    background: "#f5f7fb",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#5b6577",
    border: "#dbe1ec",
  },
  {
    label: "Crisp White",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    muted: "#475569",
    border: "#e2e8f0",
  },
];
