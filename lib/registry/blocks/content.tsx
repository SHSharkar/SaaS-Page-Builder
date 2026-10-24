import { z } from "zod";
import { Glyph, GLYPH_OPTIONS, MediaImage, RichText, Section, SectionHeading } from "../shell";
import type { BlockDefinition } from "../types";
import { SlideCarousel } from "@/components/blocks/slide-carousel";

const IMAGE_NULL = z.object({ id: z.string() }).nullable().catch(null);

/* ------------------------------- rich text ------------------------------- */

export const richText: BlockDefinition<{
  eyebrow: string;
  heading: string;
  body: string;
  align: "left" | "center";
}> = {
  alias: "rich-text",
  name: "Rich text",
  group: "content",
  description: "A heading and formatted paragraphs — bold, italic, links and bullets.",
  summary: "Heading and formatted copy",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "" },
    { key: "heading", label: "Heading", type: "text", default: "How Trofeo works" },
    {
      key: "body",
      label: "Body",
      type: "textarea",
      help: "Blank line between paragraphs. **bold**, *italic*, [text](url), and lines starting with - become bullets.",
      default:
        "Trofeo turns everyday play into **collectable trophies**. Every game you open adds to your progress.\n\n- Track trophies in one wallet\n- Redeem for gift cards or bonus cash\n- No purchase ever required",
    },
    {
      key: "align",
      label: "Alignment",
      type: "select",
      options: [
        { label: "Left", value: "left" },
        { label: "Centre", value: "center" },
      ],
      default: "left",
    },
  ],
  defaults: {
    eyebrow: "",
    heading: "How Trofeo works",
    body: "Trofeo turns everyday play into **collectable trophies**. Every game you open adds to your progress.\n\n- Track trophies in one wallet\n- Redeem for gift cards or bonus cash",
    align: "left",
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    heading: z.string().catch(""),
    body: z.string().catch(""),
    align: z.enum(["left", "center"]).catch("left"),
  }),
  render: ({ eyebrow, heading, body, align, appearance }) => (
    <Section appearance={appearance}>
      <div className={align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
        <SectionHeading eyebrow={eyebrow} title={heading} align={align} />
        <RichText text={body} className="text-[15px] leading-relaxed text-[color:var(--site-muted)]" />
      </div>
    </Section>
  ),
};

/* --------------------------------- image --------------------------------- */

export const imageBlock: BlockDefinition<{
  image: { id: string } | null;
  alt: string;
  caption: string;
  href: string;
  aspect: "auto" | "16:9" | "4:3" | "1:1";
}> = {
  alias: "image",
  name: "Image",
  group: "content",
  description: "A single image with caption, optional link and fixed aspect ratio.",
  summary: "Single image with caption",
  fields: [
    { key: "image", label: "Image", type: "image" },
    { key: "alt", label: "Alt text (accessibility)", type: "text", default: "" },
    { key: "caption", label: "Caption", type: "text", default: "" },
    { key: "href", label: "Links to", type: "text", default: "" },
    {
      key: "aspect",
      label: "Aspect ratio",
      type: "select",
      options: [
        { label: "Natural", value: "auto" },
        { label: "16:9", value: "16:9" },
        { label: "4:3", value: "4:3" },
        { label: "Square", value: "1:1" },
      ],
      default: "auto",
    },
  ],
  defaults: { image: null, alt: "", caption: "", href: "", aspect: "auto" },
  schema: z.looseObject({
    image: IMAGE_NULL,
    alt: z.string().catch(""),
    caption: z.string().catch(""),
    href: z.string().catch(""),
    aspect: z.enum(["auto", "16:9", "4:3", "1:1"]).catch("auto"),
  }),
  render: ({ image, alt, caption, href, aspect, appearance }) => {
    const ratio = { auto: undefined, "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1" }[aspect];
    const media = (
      <div style={ratio ? { aspectRatio: ratio, overflow: "hidden" } : undefined}>
        <MediaImage
          value={image}
          alt={alt}
          className={`w-full ${ratio ? "h-full object-cover" : ""}`}
          fallbackLabel="Image"
        />
      </div>
    );
    return (
      <Section appearance={appearance}>
        <figure className="mx-auto max-w-4xl">
          {href ? (
            <a href={href} className="block">
              {media}
            </a>
          ) : (
            media
          )}
          {caption ? (
            <figcaption className="mt-2 text-center text-xs" style={{ color: "var(--site-muted)" }}>
              {caption}
            </figcaption>
          ) : null}
        </figure>
      </Section>
    );
  },
};

/* -------------------------------- carousel -------------------------------- */

export const carousel: BlockDefinition<{
  eyebrow: string;
  title: string;
  slides: {
    image: { id: string } | null;
    title: string;
    text: string;
    ctaLabel: string;
    ctaHref: string;
  }[];
  autoplay: boolean;
  autoplaySeconds: number;
}> = {
  alias: "carousel",
  name: "Carousel",
  group: "content",
  description: "Image or promo slides with arrows, dots, keyboard control and reduced-motion respect.",
  summary: "Slides with arrows and dots",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Featured" },
    { key: "title", label: "Section title", type: "text", default: "This week's highlights" },
    {
      key: "slides",
      label: "Slides",
      type: "repeater",
      itemLabel: (item) => String(item.title ?? "Slide"),
      defaultItem: { image: null, title: "New slide", text: "", ctaLabel: "", ctaHref: "" },
      fields: [
        { key: "image", label: "Image", type: "image" },
        { key: "title", label: "Title", type: "text", default: "New slide" },
        { key: "text", label: "Text", type: "textarea", default: "" },
        { key: "ctaLabel", label: "Button label", type: "text", default: "" },
        { key: "ctaHref", label: "Button link", type: "text", default: "" },
      ],
    },
    { key: "autoplay", label: "Advance automatically", type: "boolean", default: true },
    { key: "autoplaySeconds", label: "Seconds per slide", type: "number", min: 3, max: 20, default: 6 },
  ],
  defaults: {
    eyebrow: "Featured",
    title: "This week's highlights",
    slides: [
      { image: null, title: "Weekend turbo trophies", text: "Double trophy points on every game.", ctaLabel: "See games", ctaHref: "/games" },
      { image: null, title: "New: Treasure Bay", text: "Fresh slots with 50 free spins.", ctaLabel: "Play now", ctaHref: "/games" },
    ],
    autoplay: true,
    autoplaySeconds: 6,
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    slides: z
      .array(
        z.object({
          image: IMAGE_NULL,
          title: z.string().catch(""),
          text: z.string().catch(""),
          ctaLabel: z.string().catch(""),
          ctaHref: z.string().catch(""),
        }),
      )
      .catch([]),
    autoplay: z.coerce.boolean().catch(true),
    autoplaySeconds: z.coerce.number().min(3).max(20).catch(6),
  }),
  render: ({ eyebrow, title, slides, autoplay, autoplaySeconds, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} />
      <SlideCarousel slides={slides} autoplay={autoplay} autoplaySeconds={autoplaySeconds} label={title || "Carousel"} />
    </Section>
  ),
};

/* ------------------------------- video embed ------------------------------- */

export const videoEmbed: BlockDefinition<{
  provider: "youtube" | "vimeo";
  videoId: string;
  title: string;
  caption: string;
  aspect: "16:9" | "4:3" | "1:1";
}> = {
  alias: "video-embed",
  name: "Video embed",
  group: "content",
  description: "YouTube or Vimeo by identifier, lazy-loaded, nothing hosted by us.",
  summary: "YouTube or Vimeo embed",
  fields: [
    {
      key: "provider",
      label: "Provider",
      type: "select",
      options: [
        { label: "YouTube", value: "youtube" },
        { label: "Vimeo", value: "vimeo" },
      ],
      default: "youtube",
    },
    { key: "videoId", label: "Video ID", type: "text", default: "dQw4w9WgXcQ" },
    { key: "title", label: "Title (for screen readers)", type: "text", default: "Product tour" },
    { key: "caption", label: "Caption", type: "text", default: "" },
    {
      key: "aspect",
      label: "Aspect ratio",
      type: "select",
      options: [
        { label: "16:9", value: "16:9" },
        { label: "4:3", value: "4:3" },
        { label: "Square", value: "1:1" },
      ],
      default: "16:9",
    },
  ],
  defaults: {
    provider: "youtube",
    videoId: "dQw4w9WgXcQ",
    title: "Product tour",
    caption: "",
    aspect: "16:9",
  },
  schema: z.looseObject({
    provider: z.enum(["youtube", "vimeo"]).catch("youtube"),
    videoId: z.string().catch(""),
    title: z.string().catch(""),
    caption: z.string().catch(""),
    aspect: z.enum(["16:9", "4:3", "1:1"]).catch("16:9"),
  }),
  render: ({ provider, videoId, title, caption, aspect, appearance }) => {
    const ratio = { "16:9": "16 / 9", "4:3": "4 / 3", "1:1": "1 / 1" }[aspect];
    const id = (videoId || "").trim();
    const src =
      provider === "youtube"
        ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`
        : `https://player.vimeo.com/video/${encodeURIComponent(id)}`;
    return (
      <Section appearance={appearance}>
        <figure className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-[var(--site-radius-lg)] border" style={{ borderColor: "var(--site-border)", aspectRatio: ratio }}>
            {id ? (
              <iframe
                src={src}
                title={title || "Embedded video"}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <div className="media-placeholder h-full">Add a video ID</div>
            )}
          </div>
          {caption ? (
            <figcaption className="mt-2 text-center text-xs" style={{ color: "var(--site-muted)" }}>
              {caption}
            </figcaption>
          ) : null}
        </figure>
      </Section>
    );
  },
};

/* -------------------------------- cards grid -------------------------------- */

export const cardsGrid: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  columns: "2" | "3" | "4";
  cards: {
    image: { id: string } | null;
    icon: string;
    title: string;
    text: string;
    ctaLabel: string;
    ctaHref: string;
  }[];
}> = {
  alias: "cards-grid",
  name: "Cards grid",
  group: "content",
  description: "Two to four cards with an image or icon, a title, text and a link.",
  summary: "2–4 cards with image or icon",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "" },
    { key: "title", label: "Section title", type: "text", default: "Popular games" },
    { key: "description", label: "Description", type: "textarea", default: "" },
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
      key: "cards",
      label: "Cards",
      type: "repeater",
      itemLabel: (item) => String(item.title ?? "Card"),
      defaultItem: { image: null, icon: "spark", title: "New card", text: "", ctaLabel: "", ctaHref: "" },
      fields: [
        { key: "image", label: "Image", type: "image" },
        { key: "icon", label: "Icon (when no image)", type: "select", options: GLYPH_OPTIONS, default: "spark" },
        { key: "title", label: "Title", type: "text", default: "New card" },
        { key: "text", label: "Text", type: "textarea", default: "" },
        { key: "ctaLabel", label: "Link label", type: "text", default: "" },
        { key: "ctaHref", label: "Link", type: "text", default: "" },
      ],
    },
  ],
  defaults: {
    eyebrow: "",
    title: "Popular games",
    description: "",
    columns: "3",
    cards: [
      { image: null, icon: "trophy", title: "Trophy slots", text: "Collect trophies on every spin.", ctaLabel: "Play", ctaHref: "/games" },
      { image: null, icon: "bolt", title: "Turbo wins", text: "Fast rounds, faster payouts.", ctaLabel: "Play", ctaHref: "/games" },
      { image: null, icon: "star", title: "Daily picks", text: "New favourites every morning.", ctaLabel: "Play", ctaHref: "/games" },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    columns: z.enum(["2", "3", "4"]).catch("3"),
    cards: z
      .array(
        z.object({
          image: IMAGE_NULL,
          icon: z.string().catch("spark"),
          title: z.string().catch(""),
          text: z.string().catch(""),
          ctaLabel: z.string().catch(""),
          ctaHref: z.string().catch(""),
        }),
      )
      .catch([]),
  }),
  render: ({ eyebrow, title, description, columns, cards, appearance }) => {
    const cols = { "2": "sm:grid-cols-2", "3": "sm:grid-cols-2 lg:grid-cols-3", "4": "sm:grid-cols-2 lg:grid-cols-4" }[columns];
    return (
      <Section appearance={appearance}>
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className={`grid gap-4 ${cols}`}>
          {cards.map((card, index) => (
            <div key={index} className="group flex flex-col overflow-hidden rounded-[var(--site-radius-md)] border card-surface">
              {card.image?.id ? (
                <MediaImage value={card.image} alt={card.title} rounded={false} className="h-40 w-full object-cover" />
              ) : (
                <div className="flex h-14 items-end px-5">
                  <span
                    className="grid h-10 w-10 place-items-center rounded-[var(--site-radius-sm)]"
                    style={{ background: "color-mix(in srgb, var(--site-accent) 16%, transparent)", color: "var(--site-accent)" }}
                  >
                    <Glyph name={card.icon} size={18} />
                  </span>
                </div>
              )}
              <div className="flex flex-1 flex-col p-5">
                <p className="font-heading text-lg leading-tight">{card.title}</p>
                {card.text ? (
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
                    {card.text}
                  </p>
                ) : null}
                {card.ctaLabel ? (
                  <a
                    href={card.ctaHref || "#"}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold"
                    style={{ color: "var(--site-accent)" }}
                  >
                    {card.ctaLabel}
                    <Glyph name="arrow" size={14} />
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Section>
    );
  },
};

/* ---------------------------------- steps ---------------------------------- */

export const steps: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  items: { title: string; text: string }[];
}> = {
  alias: "steps",
  name: "Numbered steps",
  group: "content",
  description: "How-it-works rows, three to eight steps, numbered with a connecting line.",
  summary: "How-it-works steps",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "How it works" },
    { key: "title", label: "Section title", type: "text", default: "Three steps to your first reward" },
    { key: "description", label: "Description", type: "textarea", default: "" },
    {
      key: "items",
      label: "Steps",
      type: "repeater",
      itemLabel: (item) => String(item.title ?? "Step"),
      defaultItem: { title: "New step", text: "" },
      fields: [
        { key: "title", label: "Title", type: "text", default: "New step" },
        { key: "text", label: "Text", type: "textarea", default: "" },
      ],
    },
  ],
  defaults: {
    eyebrow: "How it works",
    title: "Three steps to your first reward",
    description: "",
    items: [
      { title: "Create a free account", text: "Sign up in under a minute. No purchase needed." },
      { title: "Play and collect", text: "Every game adds trophies to your wallet." },
      { title: "Redeem rewards", text: "Swap trophies for gift cards or bonus cash." },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    items: z.array(z.object({ title: z.string().catch(""), text: z.string().catch("") })).catch([]),
  }),
  render: ({ eyebrow, title, description, items, appearance }) => (
    <Section appearance={appearance} className="scroll-mt-24">
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      <ol className="relative grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <li key={index} className="relative rounded-[var(--site-radius-md)] border p-5 card-surface">
            <span
              className="grid h-9 w-9 place-items-center rounded-full font-heading text-sm font-bold"
              style={{ background: "var(--site-accent)", color: "var(--site-accent-contrast)" }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <p className="mt-4 font-heading text-lg leading-tight">{item.title}</p>
            {item.text ? (
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
                {item.text}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  ),
};

/* ------------------------------ features grid ------------------------------ */

export const featuresGrid: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  variant: "cards" | "stats";
  items: { icon: string; value: string; title: string; text: string }[];
}> = {
  alias: "features-grid",
  name: "Features and stats",
  group: "content",
  description: "Icon, title and text cards, or a stats row when the variant is set to numbers.",
  summary: "Feature cards or stat numbers",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "" },
    { key: "title", label: "Section title", type: "text", default: "Why players stay" },
    { key: "description", label: "Description", type: "textarea", default: "" },
    {
      key: "variant",
      label: "Variant",
      type: "select",
      options: [
        { label: "Feature cards", value: "cards" },
        { label: "Stat numbers", value: "stats" },
      ],
      default: "cards",
    },
    {
      key: "items",
      label: "Items",
      type: "repeater",
      itemLabel: (item) => String(item.title ?? "Item"),
      defaultItem: { icon: "shield", value: "10k", title: "New item", text: "" },
      fields: [
        { key: "icon", label: "Icon", type: "select", options: GLYPH_OPTIONS, default: "shield" },
        { key: "value", label: "Stat value (stats variant)", type: "text", default: "10k" },
        { key: "title", label: "Title", type: "text", default: "New item" },
        { key: "text", label: "Text", type: "textarea", default: "" },
      ],
    },
  ],
  defaults: {
    eyebrow: "",
    title: "Why players stay",
    description: "",
    variant: "cards",
    items: [
      { icon: "shield", value: "18+", title: "Licensed and audited", text: "Independent testing on every game." },
      { icon: "bolt", value: "24h", title: "Fast payouts", text: "Withdrawals land within a day." },
      { icon: "gift", value: "50k", title: "Rewards claimed", text: "Real gift cards, every week." },
    ],
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    variant: z.enum(["cards", "stats"]).catch("cards"),
    items: z
      .array(z.object({ icon: z.string().catch("shield"), value: z.string().catch(""), title: z.string().catch(""), text: z.string().catch("") }))
      .catch([]),
  }),
  render: ({ eyebrow, title, description, variant, items, appearance }) => (
    <Section appearance={appearance}>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} />
      {variant === "stats" ? (
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-[var(--site-radius-md)] border p-6 text-center card-surface">
              <dd className="font-heading text-4xl leading-none tracking-tight" style={{ color: "var(--site-accent)" }}>
                {item.value || item.title}
              </dd>
              <dt className="mt-2 text-sm font-medium">{item.title}</dt>
              {item.text ? (
                <p className="mt-1 text-xs" style={{ color: "var(--site-muted)" }}>
                  {item.text}
                </p>
              ) : null}
            </div>
          ))}
        </dl>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => (
            <div key={index} className="rounded-[var(--site-radius-md)] border p-6 card-surface">
              <span
                className="grid h-10 w-10 place-items-center rounded-[var(--site-radius-sm)]"
                style={{ background: "color-mix(in srgb, var(--site-accent) 16%, transparent)", color: "var(--site-accent)" }}
              >
                <Glyph name={item.icon} size={18} />
              </span>
              <p className="mt-4 font-heading text-lg leading-tight">{item.title}</p>
              {item.text ? (
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
                  {item.text}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Section>
  ),
};

/* ----------------------------------- FAQ ----------------------------------- */

export const faq: BlockDefinition<{
  eyebrow: string;
  title: string;
  description: string;
  items: { question: string; answer: string }[];
  structuredData: boolean;
}> = {
  alias: "faq",
  name: "FAQ",
  group: "content",
  description: "Question and answer rows that can emit FAQPage structured data for search.",
  summary: "Questions with structured data",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text", default: "Questions" },
    { key: "title", label: "Section title", type: "text", default: "Frequently asked" },
    { key: "description", label: "Description", type: "textarea", default: "" },
    {
      key: "items",
      label: "Questions",
      type: "repeater",
      itemLabel: (item) => String(item.question ?? "Question"),
      defaultItem: { question: "New question", answer: "" },
      fields: [
        { key: "question", label: "Question", type: "text", default: "New question" },
        { key: "answer", label: "Answer", type: "textarea", default: "" },
      ],
    },
    { key: "structuredData", label: "Emit FAQPage schema", type: "boolean", default: true },
  ],
  defaults: {
    eyebrow: "Questions",
    title: "Frequently asked",
    description: "",
    items: [
      { question: "Is Trofeo free?", answer: "Yes. Creating an account and playing social games is free." },
      { question: "How long does a withdrawal take?", answer: "Most withdrawals land within 24 hours." },
    ],
    structuredData: true,
  },
  schema: z.looseObject({
    eyebrow: z.string().catch(""),
    title: z.string().catch(""),
    description: z.string().catch(""),
    items: z.array(z.object({ question: z.string().catch(""), answer: z.string().catch("") })).catch([]),
    structuredData: z.coerce.boolean().catch(true),
  }),
  render: ({ eyebrow, title, description, items, structuredData, appearance }) => {
    const jsonLd = structuredData
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: items.map((item) => ({
            "@type": "Question",
            name: item.question,
            acceptedAnswer: { "@type": "Answer", text: item.answer },
          })),
        }
      : null;
    return (
      <Section appearance={appearance}>
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        <div className="mx-auto max-w-3xl divide-y" style={{ borderColor: "var(--site-border)" }}>
          {items.map((item, index) => (
            <details key={index} className="group border-b py-4" style={{ borderColor: "var(--site-border)" }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                <span className="font-heading text-base">{item.question}</span>
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full border transition group-open:rotate-45"
                  style={{ borderColor: "var(--site-border)", color: "var(--site-muted)" }}
                  aria-hidden="true"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 5h2v14h-2zM5 11h14v2H5z" />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--site-muted)" }}>
                {item.answer}
              </p>
            </details>
          ))}
        </div>
        {jsonLd ? (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
          />
        ) : null}
      </Section>
    );
  },
};

/* ------------------------------ divider spacer ------------------------------ */

export const dividerSpacer: BlockDefinition<{
  kind: "divider" | "space";
  height: "sm" | "md" | "lg";
  lineStyle: "solid" | "dashed" | "dotted";
}> = {
  alias: "divider-spacer",
  name: "Divider / spacer",
  group: "content",
  description: "A rule or empty breathing room with three sizes and three line styles.",
  summary: "Rule or empty space",
  fields: [
    {
      key: "kind",
      label: "Type",
      type: "select",
      options: [
        { label: "Divider line", value: "divider" },
        { label: "Empty space", value: "space" },
      ],
      default: "divider",
    },
    {
      key: "height",
      label: "Size",
      type: "select",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
      default: "md",
    },
    {
      key: "lineStyle",
      label: "Line style",
      type: "select",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Dashed", value: "dashed" },
        { label: "Dotted", value: "dotted" },
      ],
      default: "solid",
    },
  ],
  defaults: { kind: "divider", height: "md", lineStyle: "solid" },
  schema: z.looseObject({
    kind: z.enum(["divider", "space"]).catch("divider"),
    height: z.enum(["sm", "md", "lg"]).catch("md"),
    lineStyle: z.enum(["solid", "dashed", "dotted"]).catch("solid"),
  }),
  render: ({ kind, height, lineStyle, appearance }) => {
    const pad = { sm: "py-4", md: "py-8", lg: "py-14" }[height];
    if (kind === "space") return <div className={pad} aria-hidden="true" />;
    return (
      <div className={`mx-auto max-w-[1160px] px-5 sm:px-8 ${pad}`}>
        <hr style={{ borderColor: "var(--site-border)", borderTopStyle: lineStyle }} />
      </div>
    );
  },
};

export const contentBlocks = [
  richText,
  imageBlock,
  carousel,
  videoEmbed,
  cardsGrid,
  steps,
  featuresGrid,
  faq,
  dividerSpacer,
];
