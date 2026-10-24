import { z } from "zod";
import { ButtonLink, Glyph, MediaImage, Section, SectionHeading, Stars } from "../shell";
import type { BlockDefinition } from "../types";
import { PricingPlans } from "@/components/blocks/pricing-plans";
import { SITE_CARD, cn, siteButton } from "@/lib/theme-classes";

const ctaSchema = z
  .object({
    label: z.string(),
    href: z.string(),
    style: z.enum(["solid", "outline", "ghost", "light"]).catch("solid"),
  })
  .catch({ label: "Claim", href: "/join", style: "solid" as const });

export const bonusCard: BlockDefinition<{
  brand: string;
  logo: { id: string } | null;
  badge: string;
  headline: string;
  subline: string;
  freeSpins: string;
  minDeposit: string;
  wagering: string;
  maxCashout: string;
  terms: string;
  rating: number;
  reviewCount: string;
  cta: { label: string; href: string; style?: "solid" | "outline" | "ghost" | "light" };
}> = {
  alias: "bonus-card",
  name: "Bonus card",
  group: "money",
  description: "The money card: bonus headline, the key wagering terms, rating and one button.",
  summary: "Full bonus terms in one card",
  fields: [
    { key: "brand", label: "Brand", type: "text", default: "Trofeo Reward" },
    { key: "logo", label: "Brand logo", type: "image" },
    { key: "badge", label: "Ribbon badge", type: "text", default: "Exclusive" },
    { key: "headline", label: "Bonus headline", type: "text", default: "100% up to $200" },
    { key: "subline", label: "Subline", type: "text", default: "+ 50 free spins on your first deposit" },
    { key: "freeSpins", label: "Free spins", type: "text", default: "50" },
    { key: "minDeposit", label: "Minimum deposit", type: "text", default: "$10" },
    { key: "wagering", label: "Wagering", type: "text", default: "35x" },
    { key: "maxCashout", label: "Maximum cashout", type: "text", default: "$2,000" },
    {
      key: "terms",
      label: "Key terms line",
      type: "text",
      default: "New players . 18+ . 35x wagering on bonus . 7 day expiry",
    },
    { key: "rating", label: "Rating out of 5", type: "number", min: 0, max: 5, default: 4.5 },
    { key: "reviewCount", label: "Review count", type: "text", default: "12,400 reviews" },
    {
      key: "cta",
      label: "Button",
      type: "link",
      default: { label: "Claim bonus", href: "/join", style: "solid" },
    },
  ],
  defaults: {
    brand: "Trofeo Reward",
    logo: null,
    badge: "Exclusive",
    headline: "100% up to $200",
    subline: "+ 50 free spins on your first deposit",
    freeSpins: "50",
    minDeposit: "$10",
    wagering: "35x",
    maxCashout: "$2,000",
    terms: "New players . 18+ . 35x wagering on bonus . 7 day expiry",
    rating: 4.5,
    reviewCount: "12,400 reviews",
    cta: { label: "Claim bonus", href: "/join", style: "solid" },
  },
  schema: z.looseObject({
    brand: z.string().catch(""),
    logo: z.object({ id: z.string() }).nullable().catch(null),
    badge: z.string().catch(""),
    headline: z.string().catch(""),
    subline: z.string().catch(""),
    freeSpins: z.string().catch(""),
    minDeposit: z.string().catch(""),
    wagering: z.string().catch(""),
    maxCashout: z.string().catch(""),
    terms: z.string().catch(""),
    rating: z.coerce.number().min(0).max(5).catch(0),
    reviewCount: z.string().catch(""),
    cta: ctaSchema,
  }),
  render: ({
    brand,
    logo,
    badge,
    headline,
    subline,
    freeSpins,
    minDeposit,
    wagering,
    maxCashout,
    terms,
    rating,
    reviewCount,
    cta,
    appearance,
  }) => {
    const stats = [
      { label: "Free spins", value: freeSpins },
      { label: "Min deposit", value: minDeposit },
      { label: "Wagering", value: wagering },
      { label: "Max cashout", value: maxCashout },
    ].filter((stat) => stat.value);
    return (
      <Section appearance={appearance}>
        <div className={cn("relative overflow-hidden rounded-site-lg border", SITE_CARD)}>
          {badge ? (
            <span className="absolute right-0 top-0 rounded-bl-site-md bg-site-accent px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-site-accent-contrast">
              {badge}
            </span>
          ) : null}
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.35fr_1fr] lg:gap-10">
            <div>
              <div className="flex items-center gap-3">
                {logo?.id ? (
                  <MediaImage value={logo} alt={brand} rounded={false} className="h-11 w-11 object-contain" />
                ) : (
                  <span
                    className="grid h-11 w-11 place-items-center rounded-site-sm bg-site-accent font-heading text-lg font-black text-site-accent-contrast"
                    aria-hidden="true"
                  >
                    {(brand || "T").slice(0, 1)}
                  </span>
                )}
                <div>
                  <p className="font-heading text-lg leading-tight text-site-text">{brand}</p>
                  <p className="flex items-center gap-2 text-xs text-site-muted">
                    <Stars rating={rating} size={12} />
                    {rating ? <span>{rating.toFixed(1)}</span> : null}
                    {reviewCount ? <span>. {reviewCount}</span> : null}
                  </p>
                </div>
              </div>
              <p className="mt-5 font-heading text-4xl leading-none tracking-tight text-site-text sm:text-5xl">
                {headline}
              </p>
              {subline ? <p className="mt-2 text-base text-site-muted">{subline}</p> : null}

              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-site-sm border border-site-border p-3">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-site-muted">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 font-heading text-lg leading-none text-site-text">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col justify-between gap-5 border-site-border lg:border-l lg:pl-8">
              <ul className="space-y-2 text-sm text-site-muted">
                <li className="flex items-center gap-2">
                  <Glyph name="check" size={15} className="text-site-accent" /> Instant bonus credit
                </li>
                <li className="flex items-center gap-2">
                  <Glyph name="shield" size={15} className="text-site-accent" /> Licensed and audited
                </li>
                <li className="flex items-center gap-2">
                  <Glyph name="wallet" size={15} className="text-site-accent" /> Withdrawals in 24 hours
                </li>
              </ul>
              <div>
                <ButtonLink link={cta} size="lg" className="w-full justify-center" />
                <p className="mt-3 text-[11px] leading-relaxed text-site-muted">{terms}</p>
              </div>
            </div>
          </div>
        </div>
      </Section>
    );
  },
};

export const bonusList: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  rows: {
    brand: string;
    offer: string;
    detail: string;
    rating: number;
    ctaLabel: string;
    ctaHref: string;
    featured: string;
  }[];
}> = {
  alias: "bonus-list",
  name: "Bonus list",
  group: "money",
  description: "Ranked bonus rows for comparison, with a rating and a button each.",
  summary: "Ranked bonus rows",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Top offers" },
    { key: "title", label: "Section title", type: "text", default: "Best welcome bonuses this week" },
    {
      key: "description",
      label: "Description",
      type: "textarea",
      default: "Verified terms, no hidden wagering.",
    },
    {
      key: "rows",
      label: "Offers",
      type: "repeater",
      itemLabel: (item) => String(item.brand ?? "Offer"),
      defaultItem: {
        brand: "New brand",
        offer: "100% up to $100",
        detail: "35x wagering",
        rating: 4,
        ctaLabel: "Claim",
        ctaHref: "/join",
        featured: "no",
      },
      fields: [
        { key: "brand", label: "Brand", type: "text", default: "New brand" },
        { key: "offer", label: "Offer", type: "text", default: "100% up to $100" },
        { key: "detail", label: "Detail line", type: "text", default: "35x wagering" },
        { key: "rating", label: "Rating", type: "number", min: 0, max: 5, default: 4 },
        { key: "ctaLabel", label: "Button label", type: "text", default: "Claim" },
        { key: "ctaHref", label: "Button link", type: "text", default: "/join" },
        {
          key: "featured",
          label: "Highlight this row",
          type: "select",
          options: [
            { label: "No", value: "no" },
            { label: "Yes", value: "yes" },
          ],
          default: "no",
        },
      ],
    },
  ],
  defaults: {
    eyebrow: "Top offers",
    title: "Best welcome bonuses this week",
    description: "Verified terms, no hidden wagering.",
    rows: [
      {
        brand: "Trofeo Reward",
        offer: "100% up to $200 + 50 spins",
        detail: "35x wagering . $10 min",
        rating: 4.5,
        ctaLabel: "Claim bonus",
        ctaHref: "/join",
        featured: "yes",
      },
      {
        brand: "Lucky Streak",
        offer: "50 free spins, no deposit",
        detail: "40x wagering . 7 day expiry",
        rating: 4.2,
        ctaLabel: "Claim spins",
        ctaHref: "/join",
        featured: "no",
      },
      {
        brand: "Treasure Bay",
        offer: "125% up to $500",
        detail: "30x wagering . crypto accepted",
        rating: 4,
        ctaLabel: "See offer",
        ctaHref: "/join",
        featured: "no",
      },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    rows: z
      .array(
        z.object({
          brand: z.string().catch(""),
          offer: z.string().catch(""),
          detail: z.string().catch(""),
          rating: z.coerce.number().min(0).max(5).catch(0),
          ctaLabel: z.string().catch("Claim"),
          ctaHref: z.string().catch("#"),
          featured: z.enum(["yes", "no"]).catch("no"),
        }),
      )
      .catch([]),
  }),
  render: ({ eyebrow, title, description, rows, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <ol className="space-y-3">
        {rows.map((row, index) => (
          <li
            key={index}
            className={cn(
              "flex flex-col gap-4 rounded-site-md border bg-site-surface p-4 text-site-text sm:flex-row sm:items-center",
              row.featured === "yes" ? "border-site-accent" : "border-site-border",
            )}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-site-accent/15 font-heading text-sm font-bold text-site-accent">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-heading text-base">{row.brand}</p>
                {row.featured === "yes" ? (
                  <span className="rounded bg-site-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-site-accent-contrast">
                    Best value
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-site-muted">
                {row.offer} . {row.detail}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-site-muted">
              <Stars rating={row.rating} size={13} />
              <span>{row.rating.toFixed(1)}</span>
            </div>
            <a className={siteButton({ variant: "solid", size: "sm" })} href={row.ctaHref || "#"}>
              {row.ctaLabel}
            </a>
          </li>
        ))}
      </ol>
    </Section>
  ),
};

type CompareRow = {
  casino: string;
  bonus: string;
  highlights: string;
  rating: number;
  ctaLabel: string;
  ctaHref: string;
  highlight: string;
};

export const casinoCompareTable: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  columns: string[];
  rows: CompareRow[];
  mobileStyle: "cards" | "scroll";
}> = {
  alias: "casino-compare-table",
  name: "Casino comparison",
  group: "money",
  description: "A comparison table with configurable columns and a mobile card view.",
  summary: "Comparison table with mobile cards",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Compare" },
    { key: "title", label: "Section title", type: "text", default: "Compare the top three" },
    { key: "description", label: "Description", type: "textarea", default: "" },
    {
      key: "columns",
      label: "Column headings",
      type: "list",
      default: ["Casino", "Welcome bonus", "Highlights", "Rating"],
    },
    {
      key: "rows",
      label: "Casinos",
      type: "repeater",
      itemLabel: (item) => String(item.casino ?? "Casino"),
      defaultItem: {
        casino: "New casino",
        bonus: "100% up to $100",
        highlights: "Fast payouts",
        rating: 4,
        ctaLabel: "Claim",
        ctaHref: "/join",
        highlight: "no",
      },
      fields: [
        { key: "casino", label: "Casino", type: "text", default: "New casino" },
        { key: "bonus", label: "Welcome bonus", type: "text", default: "100% up to $100" },
        { key: "highlights", label: "Highlights", type: "text", default: "Fast payouts" },
        { key: "rating", label: "Rating", type: "number", min: 0, max: 5, default: 4 },
        { key: "ctaLabel", label: "Button label", type: "text", default: "Claim" },
        { key: "ctaHref", label: "Button link", type: "text", default: "/join" },
        {
          key: "highlight",
          label: "Highlight this row",
          type: "select",
          options: [
            { label: "No", value: "no" },
            { label: "Yes", value: "yes" },
          ],
          default: "no",
        },
      ],
    },
    {
      key: "mobileStyle",
      label: "Mobile view",
      type: "select",
      options: [
        { label: "Stacked cards", value: "cards" },
        { label: "Horizontal scroll", value: "scroll" },
      ],
      default: "cards",
    },
  ],
  defaults: {
    eyebrow: "Compare",
    title: "Compare the top three",
    description: "",
    columns: ["Casino", "Welcome bonus", "Highlights", "Rating"],
    rows: [
      {
        casino: "Trofeo Reward",
        bonus: "100% up to $200",
        highlights: "24h payouts . 3,000+ games",
        rating: 4.5,
        ctaLabel: "Claim",
        ctaHref: "/join",
        highlight: "yes",
      },
      {
        casino: "Lucky Streak",
        bonus: "50 free spins",
        highlights: "No deposit needed",
        rating: 4.2,
        ctaLabel: "Claim",
        ctaHref: "/join",
        highlight: "no",
      },
      {
        casino: "Treasure Bay",
        bonus: "125% up to $500",
        highlights: "Crypto friendly",
        rating: 4,
        ctaLabel: "Claim",
        ctaHref: "/join",
        highlight: "no",
      },
    ],
    mobileStyle: "cards",
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    columns: z.array(z.string()).catch([]),
    rows: z
      .array(
        z.object({
          casino: z.string().catch(""),
          bonus: z.string().catch(""),
          highlights: z.string().catch(""),
          rating: z.coerce.number().min(0).max(5).catch(0),
          ctaLabel: z.string().catch("Claim"),
          ctaHref: z.string().catch("#"),
          highlight: z.enum(["yes", "no"]).catch("no"),
        }),
      )
      .catch([]),
    mobileStyle: z.enum(["cards", "scroll"]).catch("cards"),
  }),
  render: ({ eyebrow, title, description, columns, rows, mobileStyle, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <div className="hidden overflow-hidden rounded-site-lg border border-site-border md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="bg-site-surface/80">
              {columns.map((column, index) => (
                <th
                  key={index}
                  scope="col"
                  className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-site-muted"
                >
                  {column}
                </th>
              ))}
              <th scope="col" className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={index}
                className={cn(
                  "border-t border-site-border text-site-text",
                  row.highlight === "yes" ? "bg-site-accent/10" : "bg-site-surface",
                )}
              >
                <td className="px-4 py-4">
                  <span className="font-heading text-base">{row.casino}</span>
                </td>
                <td className="px-4 py-4 font-medium">{row.bonus}</td>
                <td className="px-4 py-4 text-site-muted">{row.highlights}</td>
                <td className="px-4 py-4">
                  <span className="flex items-center gap-1.5">
                    <Stars rating={row.rating} size={12} /> {row.rating.toFixed(1)}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <a className={siteButton({ variant: "solid", size: "sm" })} href={row.ctaHref || "#"}>
                    {row.ctaLabel}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div
        className={
          mobileStyle === "cards"
            ? "grid gap-3 md:hidden"
            : "-mx-5 flex snap-x gap-3 overflow-x-auto px-5 pb-2 md:hidden"
        }
      >
        {rows.map((row, index) => (
          <div
            key={index}
            className={cn(
              "rounded-site-md border bg-site-surface p-4 text-site-text",
              row.highlight === "yes" ? "border-site-accent" : "border-site-border",
              mobileStyle !== "cards" && "min-w-[80%] snap-start",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-heading text-base">{row.casino}</p>
              <span className="flex items-center gap-1 text-xs text-site-muted">
                <Stars rating={row.rating} size={11} /> {row.rating.toFixed(1)}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold">{row.bonus}</p>
            <p className="mt-1 text-xs text-site-muted">{row.highlights}</p>
            <a
              className={cn(siteButton({ variant: "solid", size: "sm" }), "mt-3 w-full justify-center")}
              href={row.ctaHref || "#"}
            >
              {row.ctaLabel}
            </a>
          </div>
        ))}
      </div>
    </Section>
  ),
};

export const pricingTable: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  plans: {
    name: string;
    monthlyPrice: string;
    yearlyPrice: string;
    period: string;
    features: string;
    ctaLabel: string;
    ctaHref: string;
    featured: string;
  }[];
  monthlyLabel: string;
  yearlyLabel: string;
  note: string;
}> = {
  alias: "pricing-table",
  name: "Pricing table",
  group: "money",
  description: "Plan cards with a monthly and yearly switch, feature lists and a featured tier.",
  summary: "Plans with billing switch",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Plans" },
    { key: "title", label: "Section title", type: "text", default: "Pick the plan that fits" },
    { key: "description", label: "Description", type: "textarea", default: "Switch or cancel any time." },
    {
      key: "plans",
      label: "Plans",
      type: "repeater",
      itemLabel: (item) => String(item.name ?? "Plan"),
      defaultItem: {
        name: "New plan",
        monthlyPrice: "$19",
        yearlyPrice: "$190",
        period: "/month",
        features: "Feature one\nFeature two",
        ctaLabel: "Choose plan",
        ctaHref: "/join",
        featured: "no",
      },
      fields: [
        { key: "name", label: "Plan name", type: "text", default: "New plan" },
        { key: "monthlyPrice", label: "Monthly price", type: "text", default: "$19" },
        { key: "yearlyPrice", label: "Yearly price", type: "text", default: "$190" },
        { key: "period", label: "Period label", type: "text", default: "/month" },
        { key: "features", label: "Features (one per line)", type: "textarea", default: "Feature one" },
        { key: "ctaLabel", label: "Button label", type: "text", default: "Choose plan" },
        { key: "ctaHref", label: "Button link", type: "text", default: "/join" },
        {
          key: "featured",
          label: "Featured tier",
          type: "select",
          options: [
            { label: "No", value: "no" },
            { label: "Yes", value: "yes" },
          ],
          default: "no",
        },
      ],
    },
    { key: "monthlyLabel", label: "Monthly label", type: "text", default: "Monthly" },
    { key: "yearlyLabel", label: "Yearly label", type: "text", default: "Yearly (save 17%)" },
    { key: "note", label: "Fine print", type: "text", default: "Prices exclude local taxes." },
  ],
  defaults: {
    eyebrow: "Plans",
    title: "Pick the plan that fits",
    description: "Switch or cancel any time.",
    plans: [
      {
        name: "Free",
        monthlyPrice: "$0",
        yearlyPrice: "$0",
        period: "/month",
        features: "3 pages\nCommunity support",
        ctaLabel: "Start free",
        ctaHref: "/join",
        featured: "no",
      },
      {
        name: "Studio",
        monthlyPrice: "$29",
        yearlyPrice: "$290",
        period: "/month",
        features: "Unlimited pages\nCustom domains\nPriority support",
        ctaLabel: "Choose Studio",
        ctaHref: "/join",
        featured: "yes",
      },
      {
        name: "Agency",
        monthlyPrice: "$79",
        yearlyPrice: "$790",
        period: "/month",
        features: "Everything in Studio\n10 client sites",
        ctaLabel: "Talk to sales",
        ctaHref: "/contact",
        featured: "no",
      },
    ],
    monthlyLabel: "Monthly",
    yearlyLabel: "Yearly (save 17%)",
    note: "Prices exclude local taxes.",
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    plans: z
      .array(
        z.object({
          name: z.string().catch(""),
          monthlyPrice: z.string().catch(""),
          yearlyPrice: z.string().catch(""),
          period: z.string().catch(""),
          features: z.string().catch(""),
          ctaLabel: z.string().catch(""),
          ctaHref: z.string().catch("#"),
          featured: z.enum(["yes", "no"]).catch("no"),
        }),
      )
      .catch([]),
    monthlyLabel: z.string().catch("Monthly"),
    yearlyLabel: z.string().catch("Yearly"),
    note: z.string().catch(""),
  }),
  render: ({ eyebrow, title, description, plans, monthlyLabel, yearlyLabel, note, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <PricingPlans plans={plans} monthlyLabel={monthlyLabel} yearlyLabel={yearlyLabel} />
      {note ? <p className="mt-4 text-center text-xs text-site-muted">{note}</p> : null}
    </Section>
  ),
};

const PAYMENT_GLYPH: Record<string, string> = {
  visa: "card",
  mastercard: "card",
  amex: "card",
  paypal: "wallet",
  skrill: "wallet",
  neteller: "wallet",
  crypto: "bolt",
  bitcoin: "bolt",
  bank: "wallet",
};

export const paymentStrip: BlockDefinition<{
  title: string;
  methods: string[];
  note: string;
}> = {
  alias: "payment-strip",
  name: "Payment methods",
  group: "money",
  description: "Accepted payment families as a trust row, with an optional note.",
  summary: "Accepted payment icons",
  fields: [
    { key: "title", label: "Title", type: "text", default: "Deposit and withdraw your way" },
    {
      key: "methods",
      label: "Methods",
      type: "list",
      default: ["Visa", "Mastercard", "PayPal", "Skrill", "Bitcoin"],
    },
    { key: "note", label: "Note", type: "text", default: "All payments are encrypted and verified." },
  ],
  defaults: {
    title: "Deposit and withdraw your way",
    methods: ["Visa", "Mastercard", "PayPal", "Skrill", "Bitcoin"],
    note: "All payments are encrypted and verified.",
  },
  schema: z.looseObject({
    title: z.string().catch(""),
    methods: z.array(z.string()).catch([]),
    note: z.string().catch(""),
  }),
  render: ({ title, methods, note, appearance }) => (
    <Section appearance={appearance} className="py-8">
      <div className="flex flex-col items-center gap-4 text-center">
        {title ? <p className="text-sm font-semibold text-site-text">{title}</p> : null}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {methods.map((method, index) => {
            const glyph = PAYMENT_GLYPH[method.toLowerCase()] ?? "card";
            return (
              <span
                key={index}
                className="flex items-center gap-2 rounded-site-sm border border-site-border px-3 py-2 text-xs font-medium text-site-muted"
              >
                <Glyph name={glyph} size={14} />
                {method}
              </span>
            );
          })}
        </div>
        {note ? <p className="text-[11px] text-site-muted">{note}</p> : null}
      </div>
    </Section>
  ),
};

export const trustStrip: BlockDefinition<{
  items: { icon: string; label: string; detail: string }[];
  text: string;
}> = {
  alias: "trust-strip",
  name: "Trust strip",
  group: "money",
  description: "Licence, age and responsible-gambling badges with a short regulated-market line.",
  summary: "Licence and responsible-play badges",
  fields: [
    {
      key: "items",
      label: "Badges",
      type: "repeater",
      itemLabel: (item) => String(item.label ?? "Badge"),
      defaultItem: { icon: "shield", label: "Licensed", detail: "Regulated operator" },
      fields: [
        {
          key: "icon",
          label: "Icon",
          type: "select",
          options: [
            { label: "Shield", value: "shield" },
            { label: "Lock", value: "lock" },
            { label: "Check", value: "check" },
            { label: "Users", value: "users" },
            { label: "Star", value: "star" },
          ],
          default: "shield",
        },
        { key: "label", label: "Label", type: "text", default: "Licensed" },
        { key: "detail", label: "Detail", type: "text", default: "Regulated operator" },
      ],
    },
    {
      key: "text",
      label: "Regulated-market line",
      type: "text",
      default: "Licensed and regulated. 18+. Play responsibly, set limits and take breaks.",
    },
  ],
  defaults: {
    items: [
      { icon: "shield", label: "Licensed", detail: "Regulated operator" },
      { icon: "lock", label: "Encrypted", detail: "256-bit payments" },
      { icon: "check", label: "Audited", detail: "Independent RNG tests" },
      { icon: "users", label: "Support", detail: "Live 24/7" },
    ],
    text: "Licensed and regulated. 18+. Play responsibly, set limits and take breaks.",
  },
  schema: z.looseObject({
    items: z
      .array(
        z.object({
          icon: z.string().catch("shield"),
          label: z.string().catch(""),
          detail: z.string().catch(""),
        }),
      )
      .catch([]),
    text: z.string().catch(""),
  }),
  render: ({ items, text, appearance }) => (
    <Section appearance={appearance} className="py-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3 rounded-site-sm border border-site-border px-3.5 py-3"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-site-accent/15 text-site-accent">
              <Glyph name={item.icon} size={15} />
            </span>
            <div>
              <p className="text-xs font-semibold text-site-text">{item.label}</p>
              <p className="text-[11px] text-site-muted">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
      {text ? <p className="mt-4 text-center text-[11px] text-site-muted">{text}</p> : null}
    </Section>
  ),
};

export const moneyBlocks = [
  bonusCard,
  bonusList,
  casinoCompareTable,
  pricingTable,
  paymentStrip,
  trustStrip,
];
