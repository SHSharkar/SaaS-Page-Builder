import { z } from "zod";
import { ButtonLink, Eyebrow, Glyph, MediaImage, Section, Stars } from "../shell";
import type { BlockDefinition } from "../types";
import { LiveCountdown } from "@/components/blocks/live-countdown";

/* --------------------------------- hero --------------------------------- */

export const hero: BlockDefinition<{
  eyebrow: string;
  title: string;
  subtitle: string;
  primary: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  secondary: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  background: { id: string } | null;
  overlay: number;
  rating: number;
  ratingLabel: string;
  align: "left" | "center";
  height: "compact" | "regular" | "tall";
  badges: string[];
}> = {
  alias: "hero",
  name: "Hero",
  group: "conversion",
  description: "The first screen: headline, subheadline, two buttons, background image and a rating line.",
  summary: "Headline, buttons and background",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Welcome to Trofeo" },
    { key: "title", label: "Headline", type: "text", default: "Play your favourites. Earn rewards." },
    {
      key: "subtitle",
      label: "Subheadline",
      type: "textarea",
      default: "Join free, collect trophies while you play, and redeem them for real rewards.",
    },
    {
      key: "primary",
      label: "Primary button",
      type: "link",
      default: { label: "Claim welcome bonus", href: "/join", style: "solid" },
    },
    {
      key: "secondary",
      label: "Secondary button",
      type: "link",
      default: { label: "See how it works", href: "#how-it-works", style: "outline" },
    },
    { key: "background", label: "Background image", type: "image" },
    { key: "overlay", label: "Image overlay (0–100)", type: "number", min: 0, max: 100, default: 55 },
    { key: "rating", label: "Rating out of 5", type: "number", min: 0, max: 5, default: 4.5 },
    { key: "ratingLabel", label: "Rating label", type: "text", default: "Rated 4.5 by 12,400 players" },
    {
      key: "align",
      label: "Alignment",
      type: "select",
      options: [
        { label: "Left", value: "left" },
        { label: "Centred", value: "center" },
      ],
      default: "left",
    },
    {
      key: "height",
      label: "Height",
      type: "select",
      options: [
        { label: "Compact", value: "compact" },
        { label: "Regular", value: "regular" },
        { label: "Tall", value: "tall" },
      ],
      default: "regular",
    },
    { key: "badges", label: "Trust badges", type: "list", default: ["18+", "Licensed", "Responsible play"] },
  ],
  defaults: {
    eyebrow: "Welcome to Trofeo",
    title: "Play your favourites. Earn rewards.",
    subtitle: "Join free, collect trophies while you play, and redeem them for real rewards.",
    primary: { label: "Claim welcome bonus", href: "/join", style: "solid" },
    secondary: { label: "See how it works", href: "#how-it-works", style: "outline" },
    background: null,
    overlay: 55,
    rating: 4.5,
    ratingLabel: "Rated 4.5 by 12,400 players",
    align: "left",
    height: "regular",
    badges: ["18+", "Licensed", "Responsible play"],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    subtitle: z.string().catch(""),
    primary: z
      .object({ label: z.string(), href: z.string(), style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid") })
      .catch({ label: "Claim", href: "/join", style: "solid" as const }),
    secondary: z
      .object({ label: z.string(), href: z.string(), style: z.enum(["solid", "outline", "ghost", "light"]).catch("outline") })
      .catch({ label: "", href: "", style: "outline" as const }),
    background: z.object({ id: z.string() }).nullable().catch(null),
    overlay: z.coerce.number().min(0).max(100).catch(55),
    rating: z.coerce.number().min(0).max(5).catch(0),
    ratingLabel: z.string().catch(""),
    align: z.enum(["left", "center"]).catch("left"),
    height: z.enum(["compact", "regular", "tall"]).catch("regular"),
    badges: z.array(z.string()).catch([]),
  }),
  render: ({
    eyebrow,
    title,
    subtitle,
    primary,
    secondary,
    background,
    overlay,
    rating,
    ratingLabel,
    align,
    height,
    badges,
    appearance,
  }) => {
    const heights = { compact: "py-16", regular: "py-24", tall: "py-32" } as const;
    return (
      <section
        id={appearance?.anchor || undefined}
        className={`relative overflow-hidden ${heights[height ?? "regular"]} ${
          appearance?.visibility === "desktop" ? "hidden md:block" : appearance?.visibility === "mobile" ? "md:hidden" : ""
        }`}
        style={{ background: "var(--site-bg)", color: "var(--site-text)" }}
        data-block-section=""
      >
        {background?.id ? (
          <div className="absolute inset-0">
            <MediaImage
              value={background}
              alt=""
              rounded={false}
              className="h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, color-mix(in srgb, var(--site-bg) ${Math.max(
                  55,
                  100 - overlay,
                )}%, transparent) 0%, color-mix(in srgb, var(--site-bg) ${Math.max(
                  20,
                  85 - overlay,
                )}%, transparent) 100%)`,
              }}
            />
          </div>
        ) : (
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(900px 480px at 78% -10%, color-mix(in srgb, var(--site-accent) 26%, transparent), transparent 65%), radial-gradient(700px 420px at 8% 110%, color-mix(in srgb, var(--site-accent) 14%, transparent), transparent 60%)",
            }}
          />
        )}
        <div
          className={`relative mx-auto max-w-[1160px] px-5 sm:px-8 ${align === "center" ? "text-center" : ""}`}
        >
          <div className={`max-w-2xl ${align === "center" ? "mx-auto" : ""}`}>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="font-heading text-4xl leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              {title}
            </h1>
            {subtitle ? (
              <p
                className="mt-5 text-base leading-relaxed sm:text-lg"
                style={{ color: "var(--site-muted)" }}
              >
                {subtitle}
              </p>
            ) : null}
            <div
              className={`mt-8 flex flex-wrap items-center gap-3 ${
                align === "center" ? "justify-center" : ""
              }`}
            >
              <ButtonLink link={primary} size="lg" />
              <ButtonLink link={secondary} size="lg" />
            </div>
            {rating > 0 ? (
              <div
                className={`mt-7 flex items-center gap-2 text-sm ${
                  align === "center" ? "justify-center" : ""
                }`}
                style={{ color: "var(--site-muted)" }}
              >
                <Stars rating={rating} />
                <span>{ratingLabel}</span>
              </div>
            ) : null}
            {badges.length ? (
              <div className={`mt-6 flex flex-wrap gap-2 ${align === "center" ? "justify-center" : ""}`}>
                {badges.map((badge, index) => (
                  <span key={index} className="chip">
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    );
  },
};

/* ------------------------------ cta button ------------------------------ */

export const ctaButton: BlockDefinition<{
  link: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  note: string;
  size: "sm" | "md" | "lg";
  fullWidth: boolean;
  align: "left" | "center" | "right";
}> = {
  alias: "cta-button",
  name: "Call to action",
  group: "conversion",
  description: "A standalone button with a note underneath, for mid-page nudges.",
  summary: "Single button with a note",
  fields: [
    {
      key: "link",
      label: "Button",
      type: "link",
      default: { label: "Claim your bonus", href: "/join", style: "solid" },
    },
    { key: "note", label: "Small note", type: "text", default: "Takes 60 seconds · No purchase needed" },
    {
      key: "size",
      label: "Size",
      type: "select",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
      default: "md",
    },
    { key: "fullWidth", label: "Full width", type: "boolean", default: false },
    {
      key: "align",
      label: "Alignment",
      type: "select",
      options: [
        { label: "Left", value: "left" },
        { label: "Centre", value: "center" },
        { label: "Right", value: "right" },
      ],
      default: "center",
    },
  ],
  defaults: {
    link: { label: "Claim your bonus", href: "/join", style: "solid" },
    note: "Takes 60 seconds · No purchase needed",
    size: "md",
    fullWidth: false,
    align: "center",
  },
  schema: z.looseObject({
    link: z
      .object({ label: z.string(), href: z.string(), style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid") })
      .catch({ label: "Claim", href: "/join", style: "solid" as const }),
    note: z.string().catch(""),
    size: z.enum(["sm", "md", "lg"]).catch("md"),
    fullWidth: z.coerce.boolean().catch(false),
    align: z.enum(["left", "center", "right"]).catch("center"),
  }),
  render: ({ link, note, size, fullWidth, align, appearance }) => (
    <Section appearance={appearance}>
      <div
        className={`flex flex-col gap-2 ${
          align === "center" ? "items-center" : align === "right" ? "items-end" : "items-start"
        }`}
      >
        <div className={fullWidth ? "w-full" : ""}>
          <ButtonLink link={link} size={size} className={fullWidth ? "w-full justify-center" : ""} />
        </div>
        {note ? (
          <p className="text-xs" style={{ color: "var(--site-muted)" }}>
            {note}
          </p>
        ) : null}
      </div>
    </Section>
  ),
};

/* ------------------------------- cta banner ------------------------------- */

export const ctaBanner: BlockDefinition<{
  title: string;
  text: string;
  primary: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  secondary: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  note: string;
}> = {
  alias: "cta-banner",
  name: "Closing call to action",
  group: "conversion",
  description: "The final conversion section: a headline, supporting line and one or two buttons.",
  summary: "Closing conversion panel",
  fields: [
    { key: "title", label: "Headline", type: "text", default: "Your next trophy is one spin away" },
    {
      key: "text",
      label: "Supporting text",
      type: "textarea",
      default: "Set up a free account in under a minute and claim the welcome bonus today.",
    },
    {
      key: "primary",
      label: "Primary button",
      type: "link",
      default: { label: "Create free account", href: "/join", style: "solid" },
    },
    {
      key: "secondary",
      label: "Secondary button",
      type: "link",
      default: { label: "Talk to support", href: "/contact", style: "ghost" },
    },
    { key: "note", label: "Fine print", type: "text", default: "18+. New players only. T&Cs apply." },
  ],
  defaults: {
    title: "Your next trophy is one spin away",
    text: "Set up a free account in under a minute and claim the welcome bonus today.",
    primary: { label: "Create free account", href: "/join", style: "solid" },
    secondary: { label: "Talk to support", href: "/contact", style: "ghost" },
    note: "18+. New players only. T&Cs apply.",
  },
  schema: z.looseObject({
    title: z.string().catch(""),
    text: z.string().catch(""),
    primary: z
      .object({ label: z.string(), href: z.string(), style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid") })
      .catch({ label: "Join", href: "/join", style: "solid" as const }),
    secondary: z
      .object({ label: z.string(), href: z.string(), style: z.enum(["solid", "outline", "ghost", "light"]).catch("ghost") })
      .catch({ label: "", href: "", style: "ghost" as const }),
    note: z.string().catch(""),
  }),
  render: ({ title, text, primary, secondary, note, appearance }) => (
    <Section appearance={appearance}>
      <div
        className="relative overflow-hidden rounded-[var(--site-radius-lg)] border p-8 sm:p-12"
        style={{
          borderColor: "color-mix(in srgb, var(--site-accent) 35%, var(--site-border))",
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--site-accent) 16%, var(--site-surface)), var(--site-surface))",
        }}
      >
        <div className="relative max-w-2xl">
          <h2 className="font-heading text-3xl leading-tight tracking-tight sm:text-4xl">{title}</h2>
          {text ? (
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--site-muted)" }}>
              {text}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink link={primary} size="lg" />
            <ButtonLink link={secondary} size="lg" />
          </div>
          {note ? (
            <p className="mt-4 text-xs" style={{ color: "var(--site-muted)" }}>
              {note}
            </p>
          ) : null}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full"
          style={{ background: "color-mix(in srgb, var(--site-accent) 22%, transparent)", filter: "blur(40px)" }}
        />
      </div>
    </Section>
  ),
};

/* ------------------------------- countdown ------------------------------- */

export const countdown: BlockDefinition<{
  title: string;
  targetDate: string;
  expiredMessage: string;
  labels: string;
  cta: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  variant: "panel" | "inline";
}> = {
  alias: "countdown",
  name: "Countdown",
  group: "conversion",
  description: "A target time with days, hours, minutes and seconds, and an expiry message.",
  summary: "Timer with expiry behaviour",
  fields: [
    { key: "title", label: "Headline", type: "text", default: "Welcome bonus ends soon" },
    { key: "targetDate", label: "Target date (ISO)", type: "text", default: "2026-12-31T23:59:00Z" },
    { key: "expiredMessage", label: "When it expires", type: "text", default: "This offer has ended — see the current bonuses." },
    { key: "labels", label: "Unit labels", type: "text", default: "Days,Hours,Minutes,Seconds" },
    {
      key: "cta",
      label: "Button",
      type: "link",
      default: { label: "Claim before it ends", href: "/join", style: "solid" },
    },
    {
      key: "variant",
      label: "Style",
      type: "select",
      options: [
        { label: "Panel", value: "panel" },
        { label: "Inline strip", value: "inline" },
      ],
      default: "panel",
    },
  ],
  defaults: {
    title: "Welcome bonus ends soon",
    targetDate: "2026-12-31T23:59:00Z",
    expiredMessage: "This offer has ended — see the current bonuses.",
    labels: "Days,Hours,Minutes,Seconds",
    cta: { label: "Claim before it ends", href: "/join", style: "solid" },
    variant: "panel",
  },
  schema: z.looseObject({
    title: z.string().catch(""),
    targetDate: z.string().catch(""),
    expiredMessage: z.string().catch(""),
    labels: z.string().catch("Days,Hours,Minutes,Seconds"),
    cta: z
      .object({ label: z.string(), href: z.string(), style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid") })
      .catch({ label: "", href: "", style: "solid" as const }),
    variant: z.enum(["panel", "inline"]).catch("panel"),
  }),
  render: ({ title, targetDate, expiredMessage, labels, cta, variant, appearance }) => (
    <Section appearance={appearance}>
      <div
        className={`flex flex-col gap-6 rounded-[var(--site-radius-lg)] border p-6 sm:p-8 ${
          variant === "inline" ? "sm:flex-row sm:items-center sm:justify-between" : "items-center text-center"
        }`}
        style={{
          borderColor: "var(--site-border)",
          background: "color-mix(in srgb, var(--site-surface) 88%, var(--site-bg))",
        }}
      >
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--site-accent)" }}>
            <Glyph name="clock" size={16} /> Offer window
          </p>
          <h3 className="mt-1 font-heading text-2xl tracking-tight">{title}</h3>
        </div>
        <LiveCountdown
          targetDate={targetDate}
          expiredMessage={expiredMessage}
          labels={labels.split(",").map((label) => label.trim())}
        />
        <ButtonLink link={cta} size="md" />
      </div>
    </Section>
  ),
};

/* ------------------------------ promo banner ------------------------------ */

export const promoBanner: BlockDefinition<{
  headline: string;
  offer: string;
  cta: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  code: string;
}> = {
  alias: "promo-banner",
  name: "Promo banner",
  group: "conversion",
  description: "The bonus-led welcome strip: headline, offer line, promo code and one button.",
  summary: "Bonus-led welcome strip",
  fields: [
    { key: "headline", label: "Headline", type: "text", default: "Up to 200 free spins" },
    { key: "offer", label: "Offer line", type: "text", default: "On your first deposit this weekend" },
    { key: "code", label: "Promo code", type: "text", default: "TROFEO200" },
    {
      key: "cta",
      label: "Button",
      type: "link",
      default: { label: "Redeem code", href: "/join", style: "solid" },
    },
  ],
  defaults: {
    headline: "Up to 200 free spins",
    offer: "On your first deposit this weekend",
    code: "TROFEO200",
    cta: { label: "Redeem code", href: "/join", style: "solid" },
  },
  schema: z.looseObject({
    headline: z.string().catch(""),
    offer: z.string().catch(""),
    code: z.string().catch(""),
    cta: z
      .object({ label: z.string(), href: z.string(), style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid") })
      .catch({ label: "", href: "", style: "solid" as const }),
  }),
  render: ({ headline, offer, code, cta, appearance }) => (
    <Section appearance={appearance}>
      <div
        className="flex flex-col items-start gap-5 rounded-[var(--site-radius-lg)] px-6 py-6 sm:flex-row sm:items-center sm:justify-between"
        style={{
          background:
            "linear-gradient(100deg, var(--site-accent), color-mix(in srgb, var(--site-accent) 70%, #ffffff))",
          color: "var(--site-accent-contrast)",
        }}
      >
        <div>
          <p className="font-heading text-2xl leading-tight tracking-tight">{headline}</p>
          <p className="mt-1 text-sm opacity-80">{offer}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {code ? (
            <span className="rounded border border-dashed border-current px-3 py-1.5 text-sm font-bold tracking-widest">
              {code}
            </span>
          ) : null}
          <ButtonLink link={cta} size="md" className="!bg-[color:var(--site-accent-contrast)] !text-[color:var(--site-accent)]" />
        </div>
      </div>
    </Section>
  ),
};

export const conversionBlocks = [hero, ctaButton, ctaBanner, countdown, promoBanner];
