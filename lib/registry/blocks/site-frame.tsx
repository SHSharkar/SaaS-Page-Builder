import { z } from "zod";
import { Glyph, MediaImage } from "../shell";
import type { BlockDefinition } from "../types";
import { MobileNavModal } from "@/components/blocks/mobile-nav-modal";
import { cn, siteButton } from "@/lib/theme-classes";

type HeaderProps = {
  logoText: string;
  logo: { id: string } | null;
  links: { label: string; href: string }[];
  cta: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  variant: "solid" | "transparent";
  sticky: boolean;
  announcement: string;
  announcementHref: string;
};

export const siteHeader: BlockDefinition<HeaderProps> = {
  alias: "site-header",
  name: "Site header",
  group: "site-frame",
  description: "Logo, menu links and the main call to action. Edited once per site, shown on every page.",
  summary: "Navigation bar with mobile menu",
  fields: [
    { key: "logoText", label: "Brand name", type: "text", default: "Trofeo" },
    { key: "logo", label: "Logo image", type: "image" },
    {
      key: "links",
      label: "Menu links",
      type: "repeater",
      defaultItem: { label: "Games", href: "/games" },
      itemLabel: (item) => String(item.label ?? "Link"),
      fields: [
        { key: "label", label: "Label", type: "text", default: "Games" },
        { key: "href", label: "Link", type: "text", default: "/games" },
      ],
    },
    {
      key: "cta",
      label: "Header button",
      type: "link",
      default: { label: "Join free", href: "/join", style: "solid" },
    },
    {
      key: "variant",
      label: "Style",
      type: "select",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Transparent over hero", value: "transparent" },
      ],
      default: "solid",
    },
    { key: "sticky", label: "Stick to the top", type: "boolean", default: true },
    { key: "announcement", label: "Announcement bar text", type: "text", default: "" },
    { key: "announcementHref", label: "Announcement link", type: "text", default: "/bonuses" },
  ],
  defaults: {
    logoText: "Trofeo",
    logo: null,
    links: [
      { label: "Games", href: "/games" },
      { label: "Bonuses", href: "/bonuses" },
      { label: "How it works", href: "/how-it-works" },
    ],
    cta: { label: "Join free", href: "/join", style: "solid" },
    variant: "solid",
    sticky: true,
    announcement: "",
    announcementHref: "/bonuses",
  },
  schema: z.looseObject({
    logoText: z.string().catch(""),
    logo: z.object({ id: z.string() }).nullable().catch(null),
    links: z.array(z.object({ label: z.string(), href: z.string() })).catch([]),
    cta: z
      .object({
        label: z.string(),
        href: z.string(),
        style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid"),
      })
      .catch({ label: "Join free", href: "/join", style: "solid" as const }),
    variant: z.enum(["solid", "transparent"]).catch("solid"),
    sticky: z.coerce.boolean().catch(true),
    announcement: z.string().catch(""),
    announcementHref: z.string().catch("/"),
  }),
  render: ({ logoText, logo, links, cta, variant, sticky, announcement, announcementHref }) => (
    <header
      data-site-header=""
      className={cn(
        "z-40 w-full border-b border-site-border text-site-text backdrop-blur-md",
        sticky && "sticky top-0",
        variant === "transparent" ? "bg-site-bg/60" : "bg-site-bg/90",
      )}
    >
      {announcement ? (
        <a
          href={announcementHref || "#"}
          className="block bg-site-accent px-4 py-2 text-center text-[13px] font-medium text-site-accent-contrast"
        >
          {announcement}
        </a>
      ) : null}
      <div className="mx-auto flex w-full items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <a href={"/" as string} className="flex items-center gap-2.5">
          {logo?.id ? (
            <MediaImage value={logo} alt={logoText} rounded={false} className="h-9 w-auto" />
          ) : (
            <span
              className="grid h-9 w-9 place-items-center rounded-site-sm bg-site-accent text-sm font-black text-site-accent-contrast"
              aria-hidden="true"
            >
              {(logoText || "T").slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="font-heading text-lg font-semibold tracking-tight">{logoText}</span>
        </a>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Main">
          {links.map((link, index) => (
            <a
              key={index}
              href={link.href || "#"}
              className="text-sm font-medium opacity-80 transition hover:opacity-100"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a
            className={cn(siteButton({ variant: "solid", size: "sm" }), "hidden md:inline-flex")}
            href={cta?.href || "#"}
          >
            {cta?.label || "Get started"}
          </a>
          <MobileNavModal
            brand={logoText || "Trofeo"}
            links={links}
            ctaLabel={cta?.label || "Get started"}
            ctaHref={cta?.href || "#"}
          />
        </div>
      </div>
    </header>
  ),
};

type FooterColumn = { title: string; links: string };

function parseLinks(raw: string): { label: string; href: string }[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, href] = line.split("|");
      return { label: (label ?? "").trim(), href: (href ?? "#").trim() || "#" };
    });
}

export const siteFooter: BlockDefinition<{
  brandLine: string;
  tagline: string;
  columns: FooterColumn[];
  legal: string;
  badges: string[];
  socials: { label: string; href: string }[];
}> = {
  alias: "site-footer",
  name: "Site footer",
  group: "site-frame",
  description: "Link columns, legal and disclosure text, licence badges. Edited once per site.",
  summary: "Link columns, legal text and badges",
  fields: [
    { key: "brandLine", label: "Brand line", type: "text", default: "Trofeo Reward" },
    { key: "tagline", label: "Tagline", type: "text", default: "Rewards that keep players playing." },
    {
      key: "columns",
      label: "Link columns",
      type: "repeater",
      defaultItem: { title: "Company", links: "About|/about" },
      itemLabel: (item) => String(item.title ?? "Column"),
      fields: [
        { key: "title", label: "Column title", type: "text", default: "Company" },
        {
          key: "links",
          label: "Links (one per line, Label|/path)",
          type: "textarea",
          default: "About|/about",
        },
      ],
    },
    {
      key: "legal",
      label: "Legal text",
      type: "textarea",
      default:
        "Trofeo Reward is a social games platform. No purchase necessary. 18+ only. Play responsibly.",
    },
    { key: "badges", label: "Licence badges", type: "list", default: ["18+", "Licensed", "RG"] },
    {
      key: "socials",
      label: "Social links",
      type: "repeater",
      defaultItem: { label: "X", href: "https://x.com" },
      itemLabel: (item) => String(item.label ?? "Social"),
      fields: [
        { key: "label", label: "Label", type: "text", default: "X" },
        { key: "href", label: "Link", type: "text", default: "https://x.com" },
      ],
    },
  ],
  defaults: {
    brandLine: "Trofeo Reward",
    tagline: "Rewards that keep players playing.",
    columns: [
      { title: "Play", links: "Games|/games\nBonuses|/bonuses\nHow it works|/how-it-works" },
      { title: "Company", links: "About|/about\nCareers|/careers\nPress|/press" },
      { title: "Support", links: "Help center|/help\nContact|/contact\nResponsible play|/responsible" },
    ],
    legal:
      "Trofeo Reward is a social games platform. No purchase necessary. 18+ only. Play responsibly.",
    badges: ["18+", "Licensed", "RG"],
    socials: [
      { label: "X", href: "https://x.com" },
      { label: "Instagram", href: "https://instagram.com" },
    ],
  },
  schema: z.looseObject({
    brandLine: z.string().catch(""),
    tagline: z.string().catch(""),
    columns: z.array(z.object({ title: z.string(), links: z.string() })).catch([]),
    legal: z.string().catch(""),
    badges: z.array(z.string()).catch([]),
    socials: z.array(z.object({ label: z.string(), href: z.string() })).catch([]),
  }),
  render: ({ brandLine, tagline, columns, legal, badges, socials }) => (
    <footer className="bg-site-surface text-site-text" data-site-footer="">
      <div className="mx-auto w-full px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <p className="font-heading text-xl font-semibold">{brandLine}</p>
            <p className="mt-2 text-sm leading-relaxed text-site-muted">{tagline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {socials.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="rounded-full border border-site-border px-3 py-1 text-xs font-medium text-site-muted hover:text-site-text"
                >
                  {social.label}
                </a>
              ))}
            </div>
          </div>
          {columns.map((column, index) => (
            <div key={index}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-site-muted">
                {column.title}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {parseLinks(column.links).map((link, i) => (
                  <li key={i}>
                    <a href={link.href} className="opacity-80 transition hover:opacity-100">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-4 border-t border-site-border pt-6 text-xs text-site-muted md:flex-row md:items-center md:justify-between">
          <p className="leading-relaxed">{legal}</p>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge, index) => (
              <span
                key={index}
                className="rounded border border-site-border px-2 py-1 font-semibold uppercase tracking-wide"
              >
                {badge}
              </span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  ),
};

export const stickyCtaDock: BlockDefinition<{
  message: string;
  primary: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  secondary: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  showOnDesktop: boolean;
}> = {
  alias: "sticky-cta-dock",
  name: "Sticky action dock",
  group: "site-frame",
  description: "Thumb-friendly bottom action bar on mobile, with one or two buttons.",
  summary: "Mobile bottom action bar",
  fields: [
    { key: "message", label: "Short message", type: "text", default: "Welcome bonus ready" },
    {
      key: "primary",
      label: "Primary button",
      type: "link",
      default: { label: "Claim now", href: "/join", style: "solid" },
    },
    {
      key: "secondary",
      label: "Secondary button",
      type: "link",
      default: { label: "Details", href: "/bonuses", style: "outline" },
    },
    { key: "showOnDesktop", label: "Also show on desktop", type: "boolean", default: false },
  ],
  defaults: {
    message: "Welcome bonus ready",
    primary: { label: "Claim now", href: "/join", style: "solid" },
    secondary: { label: "Details", href: "/bonuses", style: "outline" },
    showOnDesktop: false,
  },
  schema: z.looseObject({
    message: z.string().catch(""),
    primary: z
      .object({
        label: z.string(),
        href: z.string(),
        style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid"),
      })
      .catch({ label: "Claim now", href: "/join", style: "solid" as const }),
    secondary: z
      .object({
        label: z.string(),
        href: z.string(),
        style: z.enum(["solid", "outline", "ghost", "light"]).catch("outline"),
      })
      .catch({ label: "", href: "", style: "outline" as const }),
    showOnDesktop: z.coerce.boolean().catch(false),
  }),
  render: ({ message, primary, secondary, showOnDesktop }) => (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 border-t border-site-border bg-site-bg/95 px-4 py-3 backdrop-blur-md",
        !showOnDesktop && "md:hidden",
      )}
    >
      <div className="mx-auto flex w-full items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-site-text">{message}</p>
          <p className="flex items-center gap-1 text-[11px] text-site-muted">
            <Glyph name="shield" size={12} /> 18+ . Play responsibly
          </p>
        </div>
        {secondary?.label ? (
          <a className={siteButton({ variant: "outline", size: "sm" })} href={secondary.href || "#"}>
            {secondary.label}
          </a>
        ) : null}
        <a className={siteButton({ variant: "solid", size: "sm" })} href={primary?.href || "#"}>
          {primary?.label || "Claim"}
        </a>
      </div>
    </div>
  ),
};

export const siteFrameBlocks = [siteHeader, siteFooter, stickyCtaDock];
