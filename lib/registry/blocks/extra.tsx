import { z } from "zod";
import { ButtonLink, Eyebrow, Glyph, MediaImage, Section, SectionHeading, Stars } from "../shell";
import type { BlockDefinition } from "../types";
import { LiveJackpot } from "@/components/blocks/live-jackpot";

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

export const announcementBar: BlockDefinition<{
  message: string;
  link: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  tone: "accent" | "dark" | "surface";
}> = {
  alias: "announcement-bar",
  name: "Announcement bar",
  group: "site-frame",
  description: "A single line above the header for a launch, a promo code or a licensing notice.",
  summary: "One-line strip above the header",
  fields: [
    { key: "message", label: "Message", type: "text", default: "Weekend boost: use code TROFEO300 for 300 free spins" },
    { key: "link", label: "Link", type: "link", default: { label: "Claim", href: "/join", style: "ghost" } },
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
  ],
  defaults: {
    message: "Weekend boost: use code TROFEO300 for 300 free spins",
    link: { label: "Claim", href: "/join", style: "ghost" },
    tone: "accent",
  },
  schema: z.looseObject({
    message: z.string().catch(""),
    link: ctaSchema,
    tone: z.enum(["accent", "dark", "surface"]).catch("accent"),
  }),
  render: ({ message, link, tone }) => {
    const styles =
      tone === "accent"
        ? { background: "var(--site-accent)", color: "var(--site-accent-contrast)" }
        : tone === "dark"
          ? { background: "#05080f", color: "#f4f6fb" }
          : { background: "var(--site-surface)", color: "var(--site-text)" };
    return (
      <div className="px-4 py-2 text-center text-[12px] font-medium" style={styles} data-block-section="">
        <span className="mr-2">{message}</span>
        {link?.label ? (
          <a href={link.href || "#"} className="underline decoration-1 underline-offset-2">
            {link.label}
          </a>
        ) : null}
      </div>
    );
  },
};

export const gameGrid: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  columns: "3" | "4" | "5";
  games: { name: string; provider: string; image: { id: string; alt?: string } | null; href: string; badge: string }[];
}> = {
  alias: "game-grid",
  name: "Game grid",
  group: "content",
  description: "A shelf of game tiles with provider names, an optional badge and outbound links.",
  summary: "Shelf of game tiles",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Play now" },
    { key: "title", label: "Heading", type: "text", default: "This week's most played" },
    { key: "description", label: "Intro", type: "textarea", default: "Fresh releases and old favourites, all counting towards trophies." },
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
    description: "Fresh releases and old favourites, all counting towards trophies.",
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
    const grid = columns === "3" ? "sm:grid-cols-3" : columns === "5" ? "sm:grid-cols-3 lg:grid-cols-5" : "sm:grid-cols-2 lg:grid-cols-4";
    return (
      <Section appearance={appearance}>
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className={`grid grid-cols-2 gap-3 ${grid}`}>
          {games.map((game, index) => (
            <a
              key={`${game.name}-${index}`}
              href={game.href || "#"}
              className="group relative block overflow-hidden rounded-[var(--site-radius-md)] border card-surface transition hover:-translate-y-0.5"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <MediaImage value={game.image} alt={game.name} rounded={false} className="h-full w-full object-cover" fallbackLabel={game.name} />
                {game.badge ? (
                  <span className="absolute left-2 top-2 rounded-full bg-[color:var(--site-accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[color:var(--site-accent-contrast)]">
                    {game.badge}
                  </span>
                ) : null}
              </div>
              <div className="px-3 py-2.5">
                <p className="truncate text-[13px] font-semibold text-[color:var(--site-text)]">{game.name}</p>
                <p className="truncate text-[11px] text-[color:var(--site-muted)]">{game.provider}</p>
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
  description: "One player quote with a rating, attribution and optional photo. Reads best on a coloured band.",
  summary: "Single quote with rating",
  fields: [
    { key: "quote", label: "Quote", type: "textarea", default: "I redeemed my first gift card eleven days after joining. No fine print games." },
    { key: "author", label: "Name", type: "text", default: "Mara K." },
    { key: "detail", label: "Detail", type: "text", default: "Player since 2024 · verified redemption" },
    { key: "rating", label: "Rating out of 5", type: "number", min: 0, max: 5, default: 5 },
    { key: "avatar", label: "Photo", type: "image" },
  ],
  defaults: {
    quote: "I redeemed my first gift card eleven days after joining. No fine print games.",
    author: "Mara K.",
    detail: "Player since 2024 · verified redemption",
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
      <figure className="mx-auto max-w-3xl text-center">
        <Stars rating={rating} size={18} />
        <blockquote className="mt-5 font-heading text-2xl leading-snug tracking-tight text-[color:var(--site-text)] sm:text-3xl">
          “{quote}”
        </blockquote>
        <figcaption className="mt-6 flex items-center justify-center gap-3">
          {avatar?.id ? (
            <span className="h-10 w-10 overflow-hidden rounded-full">
              <MediaImage value={avatar} alt={author} rounded={false} className="h-full w-full object-cover" />
            </span>
          ) : (
            <span
              className="grid h-10 w-10 place-items-center rounded-full text-[13px] font-bold"
              style={{ background: "var(--site-accent)", color: "var(--site-accent-contrast)" }}
              aria-hidden="true"
            >
              {author.trim().charAt(0) || "?"}
            </span>
          )}
          <span className="text-left">
            <span className="block text-[13px] font-semibold text-[color:var(--site-text)]">{author}</span>
            <span className="block text-[11px] text-[color:var(--site-muted)]">{detail}</span>
          </span>
        </figcaption>
      </figure>
    </Section>
  ),
};

export const jackpotCounter: BlockDefinition<{
  label: string;
  amount: number;
  currency: string;
  subline: string;
  cta: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
  note: string;
}> = {
  alias: "jackpot-counter",
  name: "Jackpot counter",
  group: "money",
  description: "A large ticking number with one button. Best used once per page, high on the screen.",
  summary: "Ticking prize number",
  fields: [
    { key: "label", label: "Label", type: "text", default: "This week's trophy pool" },
    { key: "amount", label: "Starting amount", type: "number", min: 0, default: 250000 },
    { key: "currency", label: "Currency symbol", type: "text", default: "$" },
    { key: "subline", label: "Sub-line", type: "text", default: "Every round you play adds to the pool." },
    { key: "cta", label: "Button", type: "link", default: { label: "Play for the pool", href: "/join", style: "solid" } },
    { key: "note", label: "Fine print", type: "text", default: "Illustrative pool · trophies are not cash" },
  ],
  defaults: {
    label: "This week's trophy pool",
    amount: 250000,
    currency: "$",
    subline: "Every round you play adds to the pool.",
    cta: { label: "Play for the pool", href: "/join", style: "solid" },
    note: "Illustrative pool · trophies are not cash",
  },
  schema: z.looseObject({
    label: z.string().catch(""),
    amount: z.coerce.number().min(0).catch(0),
    currency: z.string().max(4).catch("$"),
    subline: z.string().catch(""),
    cta: ctaSchema,
    note: z.string().catch(""),
  }),
  render: ({ label, amount, currency, subline, cta, note, appearance }) => (
    <Section appearance={appearance ?? { spacing: "lg", background: "dark" }}>
      <div className="mx-auto max-w-2xl">
        <LiveJackpot start={amount} currency={currency} label={label} />
        {subline ? <p className="mt-3 text-center text-sm text-[color:var(--site-muted)]">{subline}</p> : null}
        <div className="mt-6 flex justify-center">
          <ButtonLink link={cta} size="lg" />
        </div>
        {note ? <p className="mt-4 text-center text-[11px] text-[color:var(--site-muted)]">{note}</p> : null}
      </div>
    </Section>
  ),
};

export const liveWinners: BlockDefinition<{
  title: string;
  subtitle: string;
  rows: { player: string; prize: string; game: string }[];
  note: string;
}> = {
  alias: "live-winners",
  name: "Recent winners",
  group: "conversion",
  description: "A short list of recent redemptions. Keeps the page feeling current without a feed integration.",
  summary: "List of recent wins",
  wave: 2,
  fields: [
    { key: "title", label: "Heading", type: "text", default: "Redeemed in the last 24 hours" },
    { key: "subtitle", label: "Intro", type: "text", default: "Payouts land within one working day." },
    {
      key: "rows",
      label: "Rows",
      type: "repeater",
      defaultItem: { player: "Player", prize: "$50 gift card", game: "Coin Blitz" },
      itemLabel: (item) => String(item.player ?? "Player"),
      min: 1,
      max: 10,
      fields: [
        { key: "player", label: "Player", type: "text", default: "Player" },
        { key: "prize", label: "Prize", type: "text", default: "$50 gift card" },
        { key: "game", label: "Game", type: "text", default: "Coin Blitz" },
      ],
    },
    { key: "note", label: "Note", type: "text", default: "Names shortened for privacy. Values are what the player asked for." },
  ],
  defaults: {
    title: "Redeemed in the last 24 hours",
    subtitle: "Payouts land within one working day.",
    rows: [
      { player: "Mara K.", prize: "$50 gift card", game: "Coin Blitz" },
      { player: "Deni P.", prize: "$25 bonus cash", game: "Trophy Trail" },
      { player: "Jonas V.", prize: "50 free spins", game: "Golden Gates" },
    ],
    note: "Names shortened for privacy. Values are what the player asked for.",
  },
  schema: z.looseObject({
    title: z.string().catch(""),
    subtitle: z.string().catch(""),
    rows: z
      .array(z.looseObject({ player: z.string(), prize: z.string().catch(""), game: z.string().catch("") }))
      .catch([]),
    note: z.string().catch(""),
  }),
  render: ({ title, subtitle, rows, note, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading title={title} description={subtitle} />
      <ul className="divide-y divide-[color:var(--site-border)] overflow-hidden rounded-[var(--site-radius-md)] border card-surface">
        {rows.map((row, index) => (
          <li key={`${row.player}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="flex items-center gap-2.5">
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold"
                style={{ background: "color-mix(in srgb, var(--site-accent) 18%, transparent)", color: "var(--site-accent)" }}
                aria-hidden="true"
              >
                {row.player.trim().charAt(0) || "•"}
              </span>
              <span className="text-[13px] text-[color:var(--site-text)]">{row.player}</span>
            </span>
            <span className="text-[12px] text-[color:var(--site-muted)]">{row.game}</span>
            <span className="text-[13px] font-semibold" style={{ color: "var(--site-accent)" }}>
              {row.prize}
            </span>
          </li>
        ))}
      </ul>
      {note ? <p className="mt-3 text-[11px] text-[color:var(--site-muted)]">{note}</p> : null}
    </Section>
  ),
};

export const vipTiers: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  tiers: { name: string; requirement: string; perks: string[]; cta: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" }; highlighted: boolean }[];
}> = {
  alias: "vip-tiers",
  name: "VIP tiers",
  group: "money",
  description: "Two to four tier cards showing what each level unlocks and how to reach it.",
  summary: "Tier comparison cards",
  wave: 2,
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Loyalty" },
    { key: "title", label: "Heading", type: "text", default: "Trophies unlock more than rewards" },
    { key: "description", label: "Intro", type: "textarea", default: "Every tier keeps your trophies and adds a faster payout window." },
    {
      key: "tiers",
      label: "Tiers",
      type: "repeater",
      defaultItem: { name: "New tier", requirement: "0 trophies", perks: ["Standard support"], cta: { label: "Join", href: "/join", style: "outline" }, highlighted: false },
      itemLabel: (item) => String(item.name ?? "Tier"),
      min: 2,
      max: 4,
      fields: [
        { key: "name", label: "Tier name", type: "text", default: "New tier" },
        { key: "requirement", label: "Requirement", type: "text", default: "0 trophies" },
        { key: "perks", label: "Perks (one per line)", type: "list", default: ["Standard support"] },
        { key: "cta", label: "Button", type: "link", default: { label: "Join", href: "/join", style: "outline" } },
        { key: "highlighted", label: "Highlight this tier", type: "boolean", default: false },
      ],
    },
  ],
  defaults: {
    eyebrow: "Loyalty",
    title: "Trophies unlock more than rewards",
    description: "Every tier keeps your trophies and adds a faster payout window.",
    tiers: [
      { name: "Bronze", requirement: "0 trophies", perks: ["Standard support", "7-day payout window"], cta: { label: "Start free", href: "/join", style: "outline" }, highlighted: false },
      { name: "Gold", requirement: "5,000 trophies", perks: ["24-hour payouts", "Monthly bonus drop", "Priority support"], cta: { label: "See rewards", href: "/rewards/wallet", style: "solid" }, highlighted: true },
      { name: "Platinum", requirement: "25,000 trophies", perks: ["Same-day payouts", "Dedicated host", "Invite-only events"], cta: { label: "See rewards", href: "/rewards/wallet", style: "outline" }, highlighted: false },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    tiers: z
      .array(
        z.looseObject({
          name: z.string(),
          requirement: z.string().catch(""),
          perks: z.array(z.string()).catch([]),
          cta: ctaSchema,
          highlighted: z.coerce.boolean().catch(false),
        }),
      )
      .catch([]),
  }),
  render: ({ eyebrow, title, description, tiers, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} align="center" />
      <div className={`grid gap-4 ${tiers.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {tiers.map((tier, index) => (
          <div
            key={`${tier.name}-${index}`}
            className="relative flex flex-col rounded-[var(--site-radius-lg)] border p-5"
            style={{
              background: tier.highlighted ? "color-mix(in srgb, var(--site-accent) 10%, var(--site-surface))" : "var(--site-surface)",
              borderColor: tier.highlighted ? "var(--site-accent)" : "var(--site-border)",
            }}
          >
            {tier.highlighted ? (
              <span
                className="absolute -top-2.5 left-5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ background: "var(--site-accent)", color: "var(--site-accent-contrast)" }}
              >
                Most popular
              </span>
            ) : null}
            <p className="font-heading text-xl tracking-tight text-[color:var(--site-text)]">{tier.name}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-[color:var(--site-muted)]">{tier.requirement}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {tier.perks.map((perk, perkIndex) => (
                <li key={perkIndex} className="flex items-start gap-2 text-[13px] text-[color:var(--site-muted)]">
                  <Glyph name="check" size={14} className="mt-0.5 shrink-0" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>
            <div className="mt-5">
              <ButtonLink link={tier.cta} className="w-full justify-center" />
            </div>
          </div>
        ))}
      </div>
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
  group: "content",
  description: "The compliance block: limits, support links and the licence line, written once and reused.",
  summary: "Compliance and support links",
  wave: 2,
  fields: [
    { key: "title", label: "Heading", type: "text", default: "Play within your limits" },
    { key: "body", label: "Body", type: "richtext", default: "Set deposit limits before you play, not after. Support is free and confidential." },
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
    { key: "licence", label: "Licence line", type: "text", default: "Licensed and regulated · 18+ · BeGambleAware" },
  ],
  defaults: {
    title: "Play within your limits",
    body: "Set deposit limits before you play, not after. Support is free and confidential.",
    links: [
      { label: "Set a limit", href: "/responsible-play" },
      { label: "Take a break", href: "/responsible-play#break" },
      { label: "Talk to someone", href: "/responsible-play#support" },
    ],
    licence: "Licensed and regulated · 18+ · BeGambleAware",
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
          <h2 className="font-heading text-2xl tracking-tight text-[color:var(--site-text)]">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--site-muted)]">{body}</p>
          <p className="mt-3 text-[11px] uppercase tracking-wider text-[color:var(--site-muted)]">{licence}</p>
        </div>
        <ul className="flex flex-wrap gap-2 md:justify-end">
          {links.map((link) => (
            <li key={link.label}>
              <a
                href={link.href || "#"}
                className="inline-flex rounded-full border border-[color:var(--site-border)] px-3.5 py-2 text-[12px] font-medium text-[color:var(--site-text)] transition hover:bg-[color:var(--site-bg)]"
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

export const appDownload: BlockDefinition<{
  title: string;
  subtitle: string;
  iosUrl: string;
  androidUrl: string;
  qr: { id: string; alt?: string } | null;
  points: string[];
}> = {
  alias: "app-download",
  name: "App download",
  group: "conversion",
  description: "Store buttons, a QR code and three short reasons to install.",
  summary: "Store links with QR code",
  wave: 2,
  fields: [
    { key: "title", label: "Heading", type: "text", default: "Play from your pocket" },
    { key: "subtitle", label: "Sub-line", type: "textarea", default: "Trophies sync across web and app. Face ID sign-in, one balance." },
    { key: "iosUrl", label: "App Store URL", type: "text", default: "https://apps.apple.com/" },
    { key: "androidUrl", label: "Google Play URL", type: "text", default: "https://play.google.com/store" },
    { key: "qr", label: "QR code image", type: "image" },
    { key: "points", label: "Reasons", type: "list", default: ["Same trophies, same wallet", "Faster payouts", "Push alerts for bonus drops"] },
  ],
  defaults: {
    title: "Play from your pocket",
    subtitle: "Trophies sync across web and app. Face ID sign-in, one balance.",
    iosUrl: "https://apps.apple.com/",
    androidUrl: "https://play.google.com/store",
    qr: null,
    points: ["Same trophies, same wallet", "Faster payouts", "Push alerts for bonus drops"],
  },
  schema: z.looseObject({
    title: z.string().catch(""),
    subtitle: z.string().catch(""),
    iosUrl: z.string().catch(""),
    androidUrl: z.string().catch(""),
    qr: mediaSchema,
    points: z.array(z.string()).catch([]),
  }),
  render: ({ title, subtitle, iosUrl, androidUrl, qr, points, appearance }) => (
    <Section appearance={appearance}>
      <div className="grid gap-6 rounded-[var(--site-radius-lg)] border card-surface p-6 sm:grid-cols-[1.4fr_1fr] sm:p-8">
        <div>
          <Eyebrow>Mobile</Eyebrow>
          <h2 className="font-heading text-2xl tracking-tight text-[color:var(--site-text)]">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-[color:var(--site-muted)]">{subtitle}</p>
          <ul className="mt-4 space-y-1.5">
            {points.map((point, index) => (
              <li key={index} className="flex items-center gap-2 text-[13px] text-[color:var(--site-muted)]">
                <Glyph name="check" size={14} />
                {point}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <a href={iosUrl || "#"} className="btn btn-solid px-4 py-2 text-[13px]">
              App Store
            </a>
            <a href={androidUrl || "#"} className="btn btn-outline px-4 py-2 text-[13px]">
              Google Play
            </a>
          </div>
        </div>
        <div className="grid place-items-center">
          {qr?.id ? (
            <MediaImage value={qr} alt="Scan to install" className="h-32 w-32 object-contain" />
          ) : (
            <div className="media-placeholder h-32 w-32 rounded-[var(--site-radius-md)] text-[11px]">QR code</div>
          )}
        </div>
      </div>
    </Section>
  ),
};

export const teamGrid: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  people: { name: string; role: string; photo: { id: string; alt?: string } | null; bio: string }[];
}> = {
  alias: "team-grid",
  name: "Team",
  group: "content",
  description: "Portraits with names and roles — useful for trust pages and operator transparency.",
  summary: "People cards",
  wave: 2,
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Who we are" },
    { key: "title", label: "Heading", type: "text", default: "Real people, real payouts" },
    { key: "description", label: "Intro", type: "text", default: "A small team in Ta' Xbiex, reachable seven days a week." },
    {
      key: "people",
      label: "People",
      type: "repeater",
      defaultItem: { name: "New person", role: "Role", photo: null, bio: "" },
      itemLabel: (item) => String(item.name ?? "Person"),
      min: 1,
      max: 8,
      fields: [
        { key: "name", label: "Name", type: "text", default: "New person" },
        { key: "role", label: "Role", type: "text", default: "Role" },
        { key: "photo", label: "Photo", type: "image" },
        { key: "bio", label: "One line", type: "text", default: "" },
      ],
    },
  ],
  defaults: {
    eyebrow: "Who we are",
    title: "Real people, real payouts",
    description: "A small team in Ta' Xbiex, reachable seven days a week.",
    people: [
      { name: "Ana Falzon", role: "Player support lead", photo: null, bio: "Answers the 3am messages." },
      { name: "Ravi Menon", role: "Rewards manager", photo: null, bio: "Keeps the trophy maths honest." },
      { name: "Sofia Borg", role: "Compliance", photo: null, bio: "Holds the licence line." },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    people: z
      .array(z.looseObject({ name: z.string(), role: z.string().catch(""), photo: mediaSchema, bio: z.string().catch("") }))
      .catch([]),
  }),
  render: ({ eyebrow, title, description, people, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((person, index) => (
          <div key={`${person.name}-${index}`} className="rounded-[var(--site-radius-md)] border card-surface p-4">
            <div className="mb-3 h-40 overflow-hidden rounded-[var(--site-radius-sm)]">
              <MediaImage value={person.photo} alt={person.name} rounded={false} className="h-full w-full object-cover" fallbackLabel={person.name} />
            </div>
            <p className="text-[14px] font-semibold text-[color:var(--site-text)]">{person.name}</p>
            <p className="text-[11px] uppercase tracking-wider text-[color:var(--site-accent)]">{person.role}</p>
            {person.bio ? <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--site-muted)]">{person.bio}</p> : null}
          </div>
        ))}
      </div>
    </Section>
  ),
};

export const timeline: BlockDefinition<{
  eyebrow: string;
  title: string;
  steps: { marker: string; title: string; text: string }[];
}> = {
  alias: "timeline",
  name: "Timeline",
  group: "content",
  description: "A vertical sequence of milestones — release notes, campaign phases or how a payout runs.",
  summary: "Vertical milestones",
  wave: 2,
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "How it works" },
    { key: "title", label: "Heading", type: "text", default: "From first spin to gift card" },
    {
      key: "steps",
      label: "Milestones",
      type: "repeater",
      defaultItem: { marker: "Today", title: "New milestone", text: "" },
      itemLabel: (item) => String(item.title ?? "Milestone"),
      min: 2,
      max: 8,
      fields: [
        { key: "marker", label: "When", type: "text", default: "Today" },
        { key: "title", label: "Title", type: "text", default: "New milestone" },
        { key: "text", label: "Detail", type: "textarea", default: "" },
      ],
    },
  ],
  defaults: {
    eyebrow: "How it works",
    title: "From first spin to gift card",
    steps: [
      { marker: "Step 1", title: "Join free", text: "No deposit needed to open an account and start collecting." },
      { marker: "Step 2", title: "Play as usual", text: "Every eligible round adds trophies to your wallet." },
      { marker: "Step 3", title: "Redeem", text: "Pick a reward, confirm, and the code lands within a day." },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    steps: z.array(z.looseObject({ marker: z.string().catch(""), title: z.string(), text: z.string().catch("") })).catch([]),
  }),
  render: ({ eyebrow, title, steps, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} />
      <ol className="relative space-y-6 border-l border-[color:var(--site-border)] pl-6">
        {steps.map((step, index) => (
          <li key={`${step.title}-${index}`} className="relative">
            <span
              className="absolute -left-[31px] top-1 grid h-4 w-4 place-items-center rounded-full text-[9px] font-bold"
              style={{ background: "var(--site-accent)", color: "var(--site-accent-contrast)" }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--site-accent)]">{step.marker}</p>
            <p className="mt-1 text-[15px] font-semibold text-[color:var(--site-text)]">{step.title}</p>
            {step.text ? <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--site-muted)]">{step.text}</p> : null}
          </li>
        ))}
      </ol>
    </Section>
  ),
};

export const imageGallery: BlockDefinition<{
  eyebrow: string;
  title: string;
  columns: "2" | "3" | "4";
  images: { image: { id: string; alt?: string } | null; caption: string }[];
}> = {
  alias: "image-gallery",
  name: "Gallery",
  group: "content",
  description: "A grid of images with captions — screenshots, venues, prize photos.",
  summary: "Image grid with captions",
  wave: 2,
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
    {
      key: "images",
      label: "Images",
      type: "repeater",
      defaultItem: { image: null, caption: "" },
      itemLabel: (item, index) => `Image ${index + 1}`,
      min: 1,
      max: 9,
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
    images: z.array(z.looseObject({ image: mediaSchema, caption: z.string().catch("") })).catch([]),
  }),
  render: ({ eyebrow, title, columns, images, appearance }) => {
    const grid = columns === "2" ? "sm:grid-cols-2" : columns === "4" ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3";
    return (
      <Section appearance={appearance}>
        <SectionHeading eyebrow={eyebrow} title={title} />
        <div className={`grid gap-3 ${grid}`}>
          {images.map((item, index) => (
            <figure key={index} className="overflow-hidden rounded-[var(--site-radius-md)] border card-surface">
              <div className="aspect-[4/3] overflow-hidden">
                <MediaImage value={item.image} alt={item.caption} rounded={false} className="h-full w-full object-cover" fallbackLabel={`Image ${index + 1}`} />
              </div>
              {item.caption ? (
                <figcaption className="px-3 py-2 text-[11px] text-[color:var(--site-muted)]">{item.caption}</figcaption>
              ) : null}
            </figure>
          ))}
        </div>
      </Section>
    );
  },
};

export const scheduleTable: BlockDefinition<{
  title: string;
  description: string;
  rows: { time: string; event: string; channel: string; note: string }[];
  note: string;
}> = {
  alias: "schedule-table",
  name: "Schedule",
  group: "content",
  description: "A simple timetable — tournament slots, stream times or support hours.",
  summary: "Timetable rows",
  wave: 2,
  fields: [
    { key: "title", label: "Heading", type: "text", default: "This week's tournaments" },
    { key: "description", label: "Intro", type: "text", default: "All times CET. Trophies double during finals." },
    {
      key: "rows",
      label: "Rows",
      type: "repeater",
      defaultItem: { time: "Mon 20:00", event: "Coin Blitz sprint", channel: "Slots", note: "" },
      itemLabel: (item) => `${item.time ?? ""} ${item.event ?? ""}`.trim(),
      min: 1,
      max: 12,
      fields: [
        { key: "time", label: "When", type: "text", default: "Mon 20:00" },
        { key: "event", label: "Event", type: "text", default: "Coin Blitz sprint" },
        { key: "channel", label: "Channel", type: "text", default: "Slots" },
        { key: "note", label: "Note", type: "text", default: "" },
      ],
    },
    { key: "note", label: "Fine print", type: "text", default: "Schedule subject to change. Check the lobby for the live list." },
  ],
  defaults: {
    title: "This week's tournaments",
    description: "All times CET. Trophies double during finals.",
    rows: [
      { time: "Mon 20:00", event: "Coin Blitz sprint", channel: "Slots", note: "1,000 trophies" },
      { time: "Wed 21:00", event: "Trophy Trail final", channel: "Slots", note: "5,000 trophies" },
      { time: "Sat 19:00", event: "Golden Gates freeroll", channel: "Live", note: "Free entry" },
    ],
    note: "Schedule subject to change. Check the lobby for the live list.",
  },
  schema: z.looseObject({
    title: z.string().catch(""),
    description: z.string().catch(""),
    rows: z
      .array(z.looseObject({ time: z.string().catch(""), event: z.string(), channel: z.string().catch(""), note: z.string().catch("") }))
      .catch([]),
    note: z.string().catch(""),
  }),
  render: ({ title, description, rows, note, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading title={title} description={description} />
      <div className="overflow-x-auto rounded-[var(--site-radius-md)] border card-surface">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--site-border)] text-[11px] uppercase tracking-wider text-[color:var(--site-muted)]">
              <th className="px-4 py-2.5 font-semibold">When</th>
              <th className="px-4 py-2.5 font-semibold">Event</th>
              <th className="px-4 py-2.5 font-semibold">Channel</th>
              <th className="px-4 py-2.5 text-right font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b border-[color:var(--site-border)] last:border-0">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-[color:var(--site-muted)]">{row.time}</td>
                <td className="px-4 py-2.5 text-[13px] text-[color:var(--site-text)]">{row.event}</td>
                <td className="px-4 py-2.5 text-[12px] text-[color:var(--site-muted)]">{row.channel}</td>
                <td className="px-4 py-2.5 text-right text-[12px]" style={{ color: "var(--site-accent)" }}>
                  {row.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {note ? <p className="mt-3 text-[11px] text-[color:var(--site-muted)]">{note}</p> : null}
    </Section>
  ),
};

export const extraBlocks = [
  announcementBar,
  gameGrid,
  testimonialQuote,
  jackpotCounter,
  liveWinners,
  vipTiers,
  responsibleGaming,
  appDownload,
  teamGrid,
  timeline,
  imageGallery,
  scheduleTable,
] as unknown as BlockDefinition[];
