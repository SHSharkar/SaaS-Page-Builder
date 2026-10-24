import { z } from "zod";
import { ButtonLink, Eyebrow, Glyph, MediaImage, Section, SectionHeading, Stars } from "../shell";
import type { BlockDefinition } from "../types";
import { LiveJackpot } from "@/components/blocks/live-jackpot";
import { AnnouncementStrip } from "@/components/blocks/announcement-strip";
import { GalleryLightbox } from "@/components/blocks/gallery-lightbox";
import { TabsPanel } from "@/components/blocks/tabs-panel";
import { SITE_CARD, SITE_MEDIA_PLACEHOLDER, cn } from "@/lib/theme-classes";

const ctaSchema = z
  .object({
    label: z.string(),
    href: z.string(),
    style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid"),
  })
  .catch({ label: "Find out more", href: "/join", style: "solid" as const });

const mediaSchema = z
  .object({ id: z.string(), alt: z.string().optional() })
  .nullable()
  .catch(null);

export const gameGrid: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  columns: "3" | "4" | "5";
  games: {
    name: string;
    provider: string;
    image: { id: string; alt?: string } | null;
    href: string;
    badge: string;
  }[];
}> = {
  alias: "game-grid",
  name: "Game grid",
  group: "content",
  wave: 1,
  description: "A shelf of game tiles with provider names, an optional badge and outbound links.",
  summary: "Shelf of game tiles",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Play now" },
    { key: "title", label: "Heading", type: "text", default: "This week's most played" },
    {
      key: "description",
      label: "Intro",
      type: "textarea",
      default: "Fresh releases and old favorites, all counting towards trophies.",
    },
    {
      key: "columns",
      label: "Columns",
      type: "select",
      options: [
        { label: "Three", value: "3" },
        { label: "Four", value: "4" },
        { label: "Five", value: "5" },
      ],
      default: "4",
    },
    {
      key: "games",
      label: "Games",
      type: "repeater",
      defaultItem: { name: "New game", provider: "Studio", image: null, href: "/games", badge: "" },
      itemLabel: (item) => String(item.name ?? "Game"),
      min: 1,
      max: 12,
      fields: [
        { key: "name", label: "Name", type: "text", default: "New game" },
        { key: "provider", label: "Provider", type: "text", default: "Studio" },
        { key: "image", label: "Tile image", type: "image" },
        { key: "href", label: "Links to", type: "text", default: "/games" },
        { key: "badge", label: "Badge", type: "text", default: "" },
      ],
    },
  ],
  defaults: {
    eyebrow: "Play now",
    title: "This week's most played",
    description: "Fresh releases and old favorites, all counting towards trophies.",
    columns: "4",
    games: [
      { name: "Coin Blitz", provider: "Northern Lights", image: null, href: "/games/coin-blitz", badge: "Hot" },
      { name: "Trophy Trail", provider: "Aurora", image: null, href: "/games/trophy-trail", badge: "" },
      { name: "Bonus Bazaar", provider: "Fableworks", image: null, href: "/games/bonus-bazaar", badge: "New" },
      { name: "Golden Gates", provider: "Delta Spin", image: null, href: "/games/golden-gates", badge: "" },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    columns: z.enum(["3", "4", "5"]).catch("4"),
    games: z
      .array(
        z.looseObject({
          name: z.string(),
          provider: z.string().catch(""),
          image: mediaSchema,
          href: z.string().catch("#"),
          badge: z.string().catch(""),
        }),
      )
      .catch([]),
  }),
  render: ({ eyebrow, title, description, columns, games, appearance }) => {
    const grid =
      columns === "3"
        ? "sm:grid-cols-3"
        : columns === "5"
          ? "sm:grid-cols-3 lg:grid-cols-5"
          : "sm:grid-cols-2 lg:grid-cols-4";
    return (
      <Section appearance={appearance}>
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className={cn("grid grid-cols-2 gap-3", grid)}>
          {games.map((game, index) => (
            <a
              key={`${game.name}-${index}`}
              href={game.href || "#"}
              className={cn(
                "group relative block overflow-hidden rounded-site-md border transition hover:-translate-y-0.5",
                SITE_CARD,
              )}
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <MediaImage
                  value={game.image}
                  alt={game.name}
                  rounded={false}
                  className="h-full w-full object-cover"
                  fallbackLabel={game.name}
                />
                {game.badge ? (
                  <span className="absolute left-2 top-2 rounded-full bg-site-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-site-accent-contrast">
                    {game.badge}
                  </span>
                ) : null}
              </div>
              <div className="px-3 py-2.5">
                <p className="text-[13px] font-semibold text-site-text">{game.name}</p>
                <p className="text-[11px] text-site-muted">{game.provider}</p>
              </div>
            </a>
          ))}
        </div>
      </Section>
    );
  },
};

export const testimonialQuote: BlockDefinition<{
  quote: string;
  author: string;
  detail: string;
  rating: number;
  avatar: { id: string; alt?: string } | null;
}> = {
  alias: "testimonial-quote",
  name: "Testimonial",
  group: "conversion",
  wave: 1,
  description: "One player quote with a rating, attribution and optional photo.",
  summary: "Single quote with rating",
  fields: [
    {
      key: "quote",
      label: "Quote",
      type: "textarea",
      default: "I redeemed my first gift card eleven days after joining. No fine print games.",
    },
    { key: "author", label: "Name", type: "text", default: "Mara K." },
    { key: "detail", label: "Detail", type: "text", default: "Player since 2024 . verified redemption" },
    { key: "rating", label: "Rating out of 5", type: "number", min: 0, max: 5, default: 5 },
    { key: "avatar", label: "Photo", type: "image" },
  ],
  defaults: {
    quote: "I redeemed my first gift card eleven days after joining. No fine print games.",
    author: "Mara K.",
    detail: "Player since 2024 . verified redemption",
    rating: 5,
    avatar: null,
  },
  schema: z.looseObject({
    quote: z.string().catch(""),
    author: z.string().catch(""),
    detail: z.string().catch(""),
    rating: z.coerce.number().min(0).max(5).catch(5),
    avatar: mediaSchema,
  }),
  render: ({ quote, author, detail, rating, avatar, appearance }) => (
    <Section appearance={appearance ?? { spacing: "lg", background: "surface" }}>
      <figure className="text-center">
        <Stars rating={rating} size={18} />
        <blockquote className="mt-5 font-heading text-2xl leading-snug tracking-tight text-site-text sm:text-3xl">
          "{quote}"
        </blockquote>
        <figcaption className="mt-6 flex items-center justify-center gap-3">
          {avatar?.id ? (
            <span className="h-10 w-10 overflow-hidden rounded-full">
              <MediaImage value={avatar} alt={author} rounded={false} className="h-full w-full object-cover" />
            </span>
          ) : (
            <span
              className="grid h-10 w-10 place-items-center rounded-full bg-site-accent text-[13px] font-bold text-site-accent-contrast"
              aria-hidden="true"
            >
              {author.trim().charAt(0) || "?"}
            </span>
          )}
          <span className="text-left">
            <span className="block text-[13px] font-semibold text-site-text">{author}</span>
            <span className="block text-[11px] text-site-muted">{detail}</span>
          </span>
        </figcaption>
      </figure>
    </Section>
  ),
};

export const responsibleGaming: BlockDefinition<{
  title: string;
  body: string;
  links: { label: string; href: string }[];
  licence: string;
}> = {
  alias: "responsible-gaming",
  name: "Responsible gaming",
  group: "money",
  wave: 1,
  description: "The compliance block: limits, support links and the licence line, written once and reused.",
  summary: "Compliance and support links",
  fields: [
    { key: "title", label: "Heading", type: "text", default: "Play within your limits" },
    {
      key: "body",
      label: "Body",
      type: "richtext",
      default: "Set deposit limits before you play, not after. Support is free and confidential.",
    },
    {
      key: "links",
      label: "Support links",
      type: "repeater",
      defaultItem: { label: "Set a limit", href: "/responsible-play" },
      itemLabel: (item) => String(item.label ?? "Link"),
      fields: [
        { key: "label", label: "Label", type: "text", default: "Set a limit" },
        { key: "href", label: "Link", type: "text", default: "/responsible-play" },
      ],
    },
    {
      key: "licence",
      label: "Licence line",
      type: "text",
      default: "Licensed and regulated . 18+ . BeGambleAware",
    },
  ],
  defaults: {
    title: "Play within your limits",
    body: "Set deposit limits before you play, not after. Support is free and confidential.",
    links: [
      { label: "Set a limit", href: "/responsible-play" },
      { label: "Take a break", href: "/responsible-play#break" },
      { label: "Talk to someone", href: "/responsible-play#support" },
    ],
    licence: "Licensed and regulated . 18+ . BeGambleAware",
  },
  schema: z.looseObject({
    title: z.string().catch(""),
    body: z.string().catch(""),
    links: z.array(z.looseObject({ label: z.string(), href: z.string().catch("#") })).catch([]),
    licence: z.string().catch(""),
  }),
  render: ({ title, body, links, licence, appearance }) => (
    <Section appearance={appearance ?? { spacing: "lg", background: "surface" }}>
      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] md:items-center">
        <div>
          <Eyebrow>Responsible play</Eyebrow>
          <h2 className="font-heading text-2xl tracking-tight text-site-text">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-site-muted">{body}</p>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-site-muted">{licence}</p>
        </div>
        <ul className="flex flex-wrap gap-2 md:justify-end">
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href || "#"}
                className="inline-flex rounded-full border border-site-border px-3.5 py-2 text-xs font-medium text-site-text transition hover:bg-site-bg"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  ),
};

export const rawHtml: BlockDefinition<{
  title: string;
  html: string;
  height: "compact" | "regular" | "tall";
}> = {
  alias: "raw-html",
  name: "Raw HTML (sandboxed)",
  group: "utility",
  wave: 1,
  adminOnly: true,
  description: "Administrator-only escape hatch rendered inside a strict zero-script sandboxed frame.",
  summary: "Admin-only sandboxed HTML",
  fields: [
    { key: "title", label: "Frame title (screen readers)", type: "text", default: "Custom HTML section" },
    {
      key: "html",
      label: "HTML markup",
      type: "textarea",
      default: "<div style=\"font-family:sans-serif;padding:16px\"><h3>Custom HTML block</h3><p>Rendered inside a scriptless sandbox.</p></div>",
    },
    {
      key: "height",
      label: "Frame height",
      type: "select",
      options: [
        { label: "Compact (160px)", value: "compact" },
        { label: "Regular (320px)", value: "regular" },
        { label: "Tall (520px)", value: "tall" },
      ],
      default: "regular",
    },
  ],
  defaults: {
    title: "Custom HTML section",
    html: "<div><h3>Custom HTML block</h3><p>Rendered inside a scriptless sandbox.</p></div>",
    height: "regular",
  },
  schema: z.looseObject({
    title: z.string().catch("Custom HTML section"),
    html: z.string().catch(""),
    height: z.enum(["compact", "regular", "tall"]).catch("regular"),
  }),
  render: ({ title, html, height, appearance }) => {
    const heightClass = { compact: "h-40", regular: "h-80", tall: "h-[520px]" }[height];
    const cleanMarkup = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
    const srcDoc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${cleanMarkup}</body></html>`;
    return (
      <Section appearance={appearance}>
        <div className="overflow-hidden rounded-site-md border border-site-border bg-site-surface">
          <iframe
            sandbox=""
            referrerPolicy="no-referrer"
            loading="lazy"
            title={title || "Custom HTML section"}
            srcDoc={srcDoc}
            className={cn("w-full border-0", heightClass)}
          />
        </div>
      </Section>
    );
  },
};

export const announcementBar: BlockDefinition<{
  message: string;
  link: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  tone: "accent" | "dark" | "surface";
  dismissible: boolean;
}> = {
  alias: "announcement-bar",
  name: "Announcement bar",
  group: "site-frame",
  wave: 2,
  description: "A dismissible single line above the header for a launch, a promo code or a licensing notice.",
  summary: "Dismissible strip above header",
  fields: [
    {
      key: "message",
      label: "Message",
      type: "text",
      default: "Weekend boost: use code TROFEO300 for 300 free spins",
    },
    {
      key: "link",
      label: "Link",
      type: "link",
      default: { label: "Claim", href: "/join", style: "ghost" },
    },
    {
      key: "tone",
      label: "Tone",
      type: "select",
      options: [
        { label: "Accent", value: "accent" },
        { label: "Deep dark", value: "dark" },
        { label: "Surface", value: "surface" },
      ],
      default: "accent",
    },
    { key: "dismissible", label: "Allow visitors to dismiss", type: "boolean", default: true },
  ],
  defaults: {
    message: "Weekend boost: use code TROFEO300 for 300 free spins",
    link: { label: "Claim", href: "/join", style: "ghost" },
    tone: "accent",
    dismissible: true,
  },
  schema: z.looseObject({
    message: z.string().catch(""),
    link: ctaSchema,
    tone: z.enum(["accent", "dark", "surface"]).catch("accent"),
    dismissible: z.coerce.boolean().catch(true),
  }),
  render: ({ message, link, tone, dismissible }) => (
    <AnnouncementStrip
      message={message}
      linkLabel={link?.label}
      linkHref={link?.href}
      tone={tone}
      dismissible={dismissible}
    />
  ),
};

export const animatedCounter: BlockDefinition<{
  label: string;
  amount: number;
  currency: string;
  suffix: string;
  step: number;
  subline: string;
  cta: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  note: string;
}> = {
  alias: "animated-counter",
  name: "Animated counter",
  group: "conversion",
  wave: 2,
  description: "A rising jackpot or trophy ticker with a label, start value and call to action.",
  summary: "Rising jackpot or trophy ticker",
  fields: [
    { key: "label", label: "Label", type: "text", default: "This week's trophy pool" },
    { key: "amount", label: "Starting value", type: "number", min: 0, default: 250000 },
    { key: "currency", label: "Prefix symbol", type: "text", default: "$" },
    { key: "suffix", label: "Suffix", type: "text", default: "" },
    { key: "step", label: "Increment per tick", type: "number", min: 0, default: 3 },
    { key: "subline", label: "Subline", type: "text", default: "Every round you play adds to the pool." },
    {
      key: "cta",
      label: "Button",
      type: "link",
      default: { label: "Play for the pool", href: "/join", style: "solid" },
    },
    { key: "note", label: "Fine print", type: "text", default: "Illustrative pool . trophies are not cash" },
  ],
  defaults: {
    label: "This week's trophy pool",
    amount: 250000,
    currency: "$",
    suffix: "",
    step: 3,
    subline: "Every round you play adds to the pool.",
    cta: { label: "Play for the pool", href: "/join", style: "solid" },
    note: "Illustrative pool . trophies are not cash",
  },
  schema: z.looseObject({
    label: z.string().catch(""),
    amount: z.coerce.number().min(0).catch(0),
    currency: z.string().max(6).catch("$"),
    suffix: z.string().max(12).catch(""),
    step: z.coerce.number().min(0).catch(3),
    subline: z.string().catch(""),
    cta: ctaSchema,
    note: z.string().catch(""),
  }),
  render: ({ label, amount, currency, suffix, step, subline, cta, note, appearance }) => (
    <Section appearance={appearance ?? { spacing: "lg", background: "dark" }}>
      <div>
        <LiveJackpot start={amount} currency={currency} suffix={suffix} step={step} label={label} />
        {subline ? <p className="mt-3 text-center text-sm text-site-muted">{subline}</p> : null}
        <div className="mt-6 flex justify-center">
          <ButtonLink link={cta} size="lg" />
        </div>
        {note ? <p className="mt-4 text-center text-[11px] text-site-muted">{note}</p> : null}
      </div>
    </Section>
  ),
};

export const payoutProofCard: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  proofs: { winner: string; amount: string; game: string; paidOn: string }[];
  note: string;
}> = {
  alias: "payout-proof-card",
  name: "Payout proof cards",
  group: "money",
  wave: 2,
  description: "Masked winner names, amounts, games and dates for verified redemption social proof.",
  summary: "Masked winner, amount, game and date",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Verified payouts" },
    { key: "title", label: "Heading", type: "text", default: "Recent verified redemptions" },
    {
      key: "description",
      label: "Description",
      type: "text",
      default: "Settled within 24 hours of confirmation.",
    },
    {
      key: "proofs",
      label: "Payout rows",
      type: "repeater",
      defaultItem: { winner: "M*** K.", amount: "$150", game: "Coin Blitz", paidOn: "2026-10-20" },
      itemLabel: (item) => `${item.winner ?? "Player"} (${item.amount ?? ""})`,
      min: 1,
      max: 12,
      fields: [
        { key: "winner", label: "Masked winner", type: "text", default: "M*** K." },
        { key: "amount", label: "Amount", type: "text", default: "$150" },
        { key: "game", label: "Game", type: "text", default: "Coin Blitz" },
        { key: "paidOn", label: "Date", type: "text", default: "2026-10-20" },
      ],
    },
    {
      key: "note",
      label: "Privacy note",
      type: "text",
      default: "Player names are masked for privacy. Amounts match settled redemptions.",
    },
  ],
  defaults: {
    eyebrow: "Verified payouts",
    title: "Recent verified redemptions",
    description: "Settled within 24 hours of confirmation.",
    proofs: [
      { winner: "M*** K.", amount: "$150", game: "Coin Blitz", paidOn: "2026-10-23" },
      { winner: "D*** P.", amount: "$75", game: "Trophy Trail", paidOn: "2026-10-22" },
      { winner: "J*** V.", amount: "$300", game: "Golden Gates", paidOn: "2026-10-21" },
    ],
    note: "Player names are masked for privacy. Amounts match settled redemptions.",
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    proofs: z
      .array(
        z.looseObject({
          winner: z.string().catch("Player"),
          amount: z.string().catch(""),
          game: z.string().catch(""),
          paidOn: z.string().catch(""),
        }),
      )
      .catch([]),
    note: z.string().catch(""),
  }),
  render: ({ eyebrow, title, description, proofs, note, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {proofs.map((proof, index) => (
          <div key={index} className={cn("rounded-site-md border p-5", SITE_CARD)}>
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-site-text">
                <Glyph name="check" size={14} className="text-site-accent" />
                {proof.winner}
              </span>
              <span className="font-mono text-xs text-site-muted">{proof.paidOn}</span>
            </div>
            <p className="mt-3 font-heading text-2xl font-bold text-site-accent">{proof.amount}</p>
            <p className="mt-1 text-xs text-site-muted">{proof.game}</p>
          </div>
        ))}
      </div>
      {note ? <p className="mt-4 text-xs text-site-muted">{note}</p> : null}
    </Section>
  ),
};

export const gallery: BlockDefinition<{
  eyebrow: string;
  title: string;
  columns: "2" | "3" | "4";
  lightbox: boolean;
  images: { image: { id: string; alt?: string } | null; caption: string }[];
}> = {
  alias: "gallery",
  name: "Gallery",
  group: "content",
  wave: 2,
  description: "An image grid with captions and an accessible centered modal lightbox.",
  summary: "Image grid with lightbox",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Gallery" },
    { key: "title", label: "Heading", type: "text", default: "Inside the rewards store" },
    {
      key: "columns",
      label: "Columns",
      type: "select",
      options: [
        { label: "Two", value: "2" },
        { label: "Three", value: "3" },
        { label: "Four", value: "4" },
      ],
      default: "3",
    },
    { key: "lightbox", label: "Open images in lightbox dialog", type: "boolean", default: true },
    {
      key: "images",
      label: "Images",
      type: "repeater",
      defaultItem: { image: null, caption: "" },
      itemLabel: (_item, index) => `Image ${index + 1}`,
      min: 1,
      max: 12,
      fields: [
        { key: "image", label: "Image", type: "image" },
        { key: "caption", label: "Caption", type: "text", default: "" },
      ],
    },
  ],
  defaults: {
    eyebrow: "Gallery",
    title: "Inside the rewards store",
    columns: "3",
    lightbox: true,
    images: [
      { image: null, caption: "Gift cards, one code per redemption" },
      { image: null, caption: "Bonus cash lands in minutes" },
      { image: null, caption: "Trophy milestones, tracked weekly" },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    columns: z.enum(["2", "3", "4"]).catch("3"),
    lightbox: z.coerce.boolean().catch(true),
    images: z.array(z.looseObject({ image: mediaSchema, caption: z.string().catch("") })).catch([]),
  }),
  render: ({ eyebrow, title, columns, lightbox, images, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} />
      <GalleryLightbox items={images} columns={columns} enableLightbox={lightbox} />
    </Section>
  ),
};

export const logoStrip: BlockDefinition<{
  title: string;
  logos: { name: string; image: { id: string; alt?: string } | null; href: string }[];
}> = {
  alias: "logo-strip",
  name: "Logo strip",
  group: "content",
  wave: 2,
  description: "Game studio, payment or partner logos arranged in a balanced trust row.",
  summary: "Studio or partner logo row",
  fields: [
    { key: "title", label: "Heading", type: "text", default: "Studios powering our lobby" },
    {
      key: "logos",
      label: "Logos",
      type: "repeater",
      defaultItem: { name: "Northern Lights", image: null, href: "" },
      itemLabel: (item) => String(item.name ?? "Partner"),
      min: 1,
      max: 12,
      fields: [
        { key: "name", label: "Partner name", type: "text", default: "Northern Lights" },
        { key: "image", label: "Logo image", type: "image" },
        { key: "href", label: "Optional link", type: "text", default: "" },
      ],
    },
  ],
  defaults: {
    title: "Studios powering our lobby",
    logos: [
      { name: "Northern Lights", image: null, href: "" },
      { name: "Aurora Gaming", image: null, href: "" },
      { name: "Fableworks", image: null, href: "" },
      { name: "Delta Spin", image: null, href: "" },
    ],
  },
  schema: z.looseObject({
    title: z.string().catch(""),
    logos: z
      .array(
        z.looseObject({
          name: z.string().catch(""),
          image: mediaSchema,
          href: z.string().catch(""),
        }),
      )
      .catch([]),
  }),
  render: ({ title, logos, appearance }) => (
    <Section appearance={appearance} className="py-8">
      {title ? (
        <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.16em] text-site-muted">
          {title}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {logos.map((logo, index) => {
          const inner = logo.image?.id ? (
            <MediaImage value={logo.image} alt={logo.name} rounded={false} className="h-10 w-auto object-contain" />
          ) : (
            <span className="font-heading text-sm font-semibold text-site-muted">{logo.name}</span>
          );
          return logo.href ? (
            <a
              key={index}
              href={logo.href}
              className="grid h-16 place-items-center rounded-site-sm border border-site-border bg-site-surface px-4 transition hover:border-site-accent"
            >
              {inner}
            </a>
          ) : (
            <div
              key={index}
              className="grid h-16 place-items-center rounded-site-sm border border-site-border bg-site-surface px-4"
            >
              {inner}
            </div>
          );
        })}
      </div>
    </Section>
  ),
};

export const tabs: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  items: { label: string; heading: string; body: string }[];
}> = {
  alias: "tabs",
  name: "Tabs",
  group: "content",
  wave: 2,
  description: "Keyboard-accessible tabbed panels for bonus rules, game categories or VIP details.",
  summary: "Tabbed content panels",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Details" },
    { key: "title", label: "Section title", type: "text", default: "Everything in one place" },
    { key: "description", label: "Description", type: "textarea", default: "" },
    {
      key: "items",
      label: "Tabs",
      type: "repeater",
      defaultItem: { label: "Overview", heading: "Overview", body: "Add tab copy here." },
      itemLabel: (item) => String(item.label ?? "Tab"),
      min: 2,
      max: 8,
      fields: [
        { key: "label", label: "Tab button label", type: "text", default: "Overview" },
        { key: "heading", label: "Panel heading", type: "text", default: "Overview" },
        { key: "body", label: "Panel body", type: "textarea", default: "" },
      ],
    },
  ],
  defaults: {
    eyebrow: "Details",
    title: "Everything in one place",
    description: "",
    items: [
      {
        label: "Welcome bonus",
        heading: "100% match on first deposit",
        body: "Deposit $10 or more to unlock your matched bonus balance and 50 free spins.",
      },
      {
        label: "Wagering rules",
        heading: "Clear, upfront terms",
        body: "Bonus funds carry a 35x playthrough within 7 days. Slots contribute 100%.",
      },
      {
        label: "Payout speed",
        heading: "Verified 24-hour withdrawals",
        body: "Approved redemptions settle to cards and wallets inside one business day.",
      },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    items: z
      .array(
        z.looseObject({
          label: z.string().catch("Tab"),
          heading: z.string().catch(""),
          body: z.string().catch(""),
        }),
      )
      .catch([]),
  }),
  render: ({ eyebrow, title, description, items, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <TabsPanel tabs={items} />
    </Section>
  ),
};

export const tableOfContents: BlockDefinition<{
  title: string;
  entries: { label: string; anchor: string }[];
}> = {
  alias: "table-of-contents",
  name: "Table of contents",
  group: "content",
  wave: 2,
  description: "Deep-link jump list pointing to section anchor identifiers on long review or legal pages.",
  summary: "Jump links to page anchors",
  fields: [
    { key: "title", label: "Heading", type: "text", default: "On this page" },
    {
      key: "entries",
      label: "Jump links",
      type: "repeater",
      defaultItem: { label: "Bonuses", anchor: "bonuses" },
      itemLabel: (item) => String(item.label ?? "Section"),
      min: 1,
      max: 16,
      fields: [
        { key: "label", label: "Label", type: "text", default: "Bonuses" },
        { key: "anchor", label: "Target anchor id (without #)", type: "text", default: "bonuses" },
      ],
    },
  ],
  defaults: {
    title: "On this page",
    entries: [
      { label: "Welcome bonus", anchor: "bonuses" },
      { label: "How it works", anchor: "how-it-works" },
      { label: "Frequently asked questions", anchor: "faq" },
    ],
  },
  schema: z.looseObject({
    title: z.string().catch("On this page"),
    entries: z
      .array(
        z.looseObject({
          label: z.string().catch(""),
          anchor: z.string().catch(""),
        }),
      )
      .catch([]),
  }),
  render: ({ title, entries, appearance }) => (
    <Section appearance={appearance} as="nav">
      <div className={cn("rounded-site-md border p-5", SITE_CARD)}>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-site-accent">{title}</p>
        <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => {
            const cleanAnchor = entry.anchor.replace(/^#+/, "").trim();
            return (
              <li key={index}>
                <a
                  href={cleanAnchor ? `#${cleanAnchor}` : "#"}
                  className="inline-flex items-center gap-2 text-sm text-site-muted transition hover:text-site-text"
                >
                  <span className="font-mono text-xs text-site-accent">{index + 1}.</span>
                  <span>{entry.label}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </Section>
  ),
};

export const embed: BlockDefinition<{
  title: string;
  url: string;
  aspect: "16:9" | "4:3" | "tall";
  caption: string;
}> = {
  alias: "embed",
  name: "Iframe embed",
  group: "utility",
  wave: 2,
  adminOnly: true,
  description: "Administrator-only HTTPS iframe embed with strict sandbox isolation.",
  summary: "Admin-only HTTPS iframe",
  fields: [
    { key: "title", label: "Frame title (screen readers)", type: "text", default: "Embedded interactive widget" },
    { key: "url", label: "HTTPS URL", type: "text", placeholder: "https://example.com/widget", default: "" },
    {
      key: "aspect",
      label: "Frame proportion",
      type: "select",
      options: [
        { label: "16:9 widescreen", value: "16:9" },
        { label: "4:3 standard", value: "4:3" },
        { label: "Tall (520px)", value: "tall" },
      ],
      default: "16:9",
    },
    { key: "caption", label: "Caption", type: "text", default: "" },
  ],
  defaults: {
    title: "Embedded interactive widget",
    url: "",
    aspect: "16:9",
    caption: "",
  },
  schema: z.looseObject({
    title: z.string().catch("Embedded interactive widget"),
    url: z.string().catch(""),
    aspect: z.enum(["16:9", "4:3", "tall"]).catch("16:9"),
    caption: z.string().catch(""),
  }),
  render: ({ title, url, aspect, caption, appearance }) => {
    const trimmed = (url || "").trim();
    const validHttps = /^https:\/\/[^\s<>"]+$/i.test(trimmed);
    const frameSize = {
      "16:9": "aspect-video",
      "4:3": "aspect-[4/3]",
      tall: "h-[520px]",
    }[aspect];
    return (
      <Section appearance={appearance}>
        <figure className="w-full">
          <div className={cn("overflow-hidden rounded-site-lg border border-site-border", frameSize)}>
            {validHttps ? (
              <iframe
                src={trimmed}
                title={title || "Embedded interactive widget"}
                sandbox="allow-scripts"
                referrerPolicy="no-referrer"
                loading="lazy"
                className="h-full w-full border-0"
              />
            ) : (
              <div className={cn(SITE_MEDIA_PLACEHOLDER, "h-full")}>
                Enter a valid HTTPS embed URL
              </div>
            )}
          </div>
          {caption ? <figcaption className="mt-2 text-center text-xs text-site-muted">{caption}</figcaption> : null}
        </figure>
      </Section>
    );
  },
};

export const extraBlocks = [
  gameGrid,
  testimonialQuote,
  responsibleGaming,
  rawHtml,
  announcementBar,
  animatedCounter,
  payoutProofCard,
  gallery,
  logoStrip,
  tabs,
  tableOfContents,
  embed,
] as unknown as BlockDefinition[];
