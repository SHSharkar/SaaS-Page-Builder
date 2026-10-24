import "server-only";
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { and, desc, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import {
  importJobs,
  type ImportJob,
  type ImportReport,
  type ImportSegment,
} from "@/lib/db/schema";
import {
  DOCUMENT_SCHEMA_VERSION,
  newBlockId,
  normalizePath,
  sanitizeRichHtml,
  type BlockNode,
  type PageDocument,
  type PageSeo,
} from "@/lib/documents";
import { COMPONENT_LIST, defaultPropsFor } from "@/lib/registry";
import { uploadMedia } from "@/lib/media";
import { isSafeRemoteUrl, safeFetchBytes } from "@/lib/media/ssrf";
import { createPage, savePageDraft } from "@/lib/pages";
import { can } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { consumeRateLimit } from "@/lib/cache";
import { assertTransition } from "@/lib/lifecycle";
import { getSettingNumber, getSettingSecret, getSettingString } from "@/lib/settings";
import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ValidationError,
} from "@/lib/errors";

export { isSafeRemoteUrl };

export const MAX_HTML_BYTES = 5 * 1024 * 1024;
export const MAX_REMOTE_IMAGE_BYTES = 8 * 1024 * 1024;

export type AnalyzeOptions = {
  fetchRemoteImages?: boolean;
  siteId?: string;
  actor?: Actor;
};

type ParsedHead = {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  canonical: string;
  noindex: boolean;
};

function parseHead($: cheerio.CheerioAPI): ParsedHead {
  const meta = (name: string) =>
    $(`meta[name="${name}"], meta[property="${name}"]`).attr("content")?.trim() ?? "";
  const robots = meta("robots").toLowerCase();
  return {
    title: $("title").first().text().trim() || $("h1").first().text().trim() || "Imported page",
    description: meta("description"),
    ogTitle: meta("og:title"),
    ogDescription: meta("og:description"),
    canonical: $('link[rel="canonical"]').attr("href")?.trim() ?? "",
    noindex: robots.includes("noindex"),
  };
}

function stripNoise($: cheerio.CheerioAPI): { strippedCount: number; warnings: string[] } {
  let stripped = 0;
  const warnings: string[] = [];
  const scripts = $("script").length;
  if (scripts > 0) {
    warnings.push(
      `Removed ${scripts} <script> element${scripts === 1 ? "" : "s"} for visitor safety.`,
    );
    stripped += scripts;
  }
  const iframes = $("iframe");
  let removedFrames = 0;
  iframes.each((_, el) => {
    const src = ($(el).attr("src") ?? "").trim();
    const isVideo = /youtube\.com|youtu\.be|vimeo\.com/i.test(src);
    if (!isVideo) {
      $(el).remove();
      removedFrames += 1;
    }
  });
  if (removedFrames > 0) {
    warnings.push(
      `Stripped ${removedFrames} third-party <iframe> element${removedFrames === 1 ? "" : "s"} (YouTube and Vimeo embeds are kept).`,
    );
    stripped += removedFrames;
  }
  const other = $("script, noscript, style, link, meta, object, embed, form, input, button[type='submit']");
  stripped += other.length;
  other.remove();
  $("*").each((_, el) => {
    if (el.type !== "tag") return;
    for (const attr of Object.keys(el.attribs ?? {})) {
      if (attr.toLowerCase().startsWith("on")) delete el.attribs[attr];
    }
  });
  return { strippedCount: stripped, warnings };
}

function topLevelRegions($: cheerio.CheerioAPI): Element[] {
  const root = $("body").length ? $("body") : $.root();
  const candidates: Element[] = [];
  const pushChildren = (container: cheerio.Cheerio<AnyNode>) => {
    container.children().each((_, child) => {
      if (child.type !== "tag") return;
      const tag = child.tagName.toLowerCase();
      if (tag === "main" || tag === "div" && $(child).children("section, header, footer, article").length >= 2) {
        pushChildren($(child));
      } else {
        candidates.push(child);
      }
    });
  };
  pushChildren(root);
  return candidates.filter((el) => $(el).text().trim().length > 0 || $(el).find("img, iframe").length > 0);
}

function textOf($: cheerio.CheerioAPI, el: AnyNode): string {
  return $(el).text().replace(/\s+/g, " ").trim();
}

function firstLink($: cheerio.CheerioAPI, scope: cheerio.Cheerio<AnyNode>): { label: string; href: string } | null {
  const btn = scope
    .find("a[href]")
    .filter((_, a) => {
      const cls = ($(a).attr("class") ?? "").toLowerCase();
      return /btn|button|cta|claim|play|join|bonus|start/.test(cls) || $(a).text().trim().length <= 36;
    })
    .first();
  const pick = btn.length ? btn : scope.find("a[href]").first();
  if (!pick.length) return null;
  const label = pick.text().replace(/\s+/g, " ").trim();
  const href = pick.attr("href")?.trim() ?? "#";
  return label ? { label: label.slice(0, 48), href } : null;
}

type Classification = {
  type: string | null;
  confidence: number;
  label: string;
  props: Record<string, unknown>;
  imageSources: { propPath: string[]; src: string; alt: string }[];
};

function classifyRegion($: cheerio.CheerioAPI, el: Element, index: number): Classification {
  const $el = $(el);
  const tag = el.tagName.toLowerCase();
  const classes = `${$el.attr("id") ?? ""} ${$el.attr("class") ?? ""}`.toLowerCase();
  const h1 = $el.find("h1").first().text().trim();
  const h2 = $el.find("h2").first().text().trim();
  const heading = h1 || h2 || $el.find("h3").first().text().trim();
  const fullText = textOf($, el);

  if (tag === "header" || (tag === "nav" && index === 0)) {
    const links: { label: string; href: string }[] = [];
    $el.find("a[href]").each((_, a) => {
      const label = $(a).text().replace(/\s+/g, " ").trim();
      const href = $(a).attr("href")?.trim() ?? "#";
      if (label && links.length < 7) links.push({ label: label.slice(0, 32), href });
    });
    const brand =
      $el.find("[class*='logo'], [class*='brand'], strong").first().text().trim() ||
      links[0]?.label ||
      "Brand";
    const cta = links.length > 3 ? links.pop() : undefined;
    return {
      type: "site-header",
      confidence: 0.92,
      label: `Site header (${links.length} links)`,
      props: {
        ...defaultPropsFor("site-header"),
        brandName: brand.slice(0, 32),
        links,
        ...(cta ? { ctaLabel: cta.label, ctaHref: cta.href } : {}),
      },
      imageSources: [],
    };
  }

  if (tag === "footer") {
    const legal = $el.find("small, p").last().text().replace(/\s+/g, " ").trim();
    const links: { label: string; href: string }[] = [];
    $el.find("a[href]").each((_, a) => {
      const label = $(a).text().replace(/\s+/g, " ").trim();
      const href = $(a).attr("href")?.trim() ?? "#";
      if (label && links.length < 8) links.push({ label: label.slice(0, 36), href });
    });
    return {
      type: "site-footer",
      confidence: 0.9,
      label: "Site footer",
      props: {
        ...defaultPropsFor("site-footer"),
        columns: links.length ? [{ heading: "Links", links }] : defaultPropsFor("site-footer").columns,
        ...(legal ? { legalNote: legal.slice(0, 360) } : {}),
      },
      imageSources: [],
    };
  }

  if (h1 || (index <= 1 && /hero|banner|jumbotron|masthead/.test(classes))) {
    const paragraphs = $el
      .find("p")
      .map((_, p) => textOf($, p))
      .get()
      .filter((t) => t.length > 12);
    const cta = firstLink($, $el);
    const img = $el.find("img[src]").first();
    const imgSrc = img.attr("src")?.trim();
    return {
      type: "hero",
      confidence: h1 ? 0.93 : 0.78,
      label: `Hero: "${(h1 || heading || "Headline").slice(0, 44)}"`,
      props: {
        ...defaultPropsFor("hero"),
        eyebrow: $el.find("[class*='eyebrow'], [class*='kicker'], [class*='badge']").first().text().trim().slice(0, 48) || "Featured offer",
        headline: (h1 || heading || "Welcome").slice(0, 140),
        subheadline: (paragraphs[0] ?? "").slice(0, 280),
        primaryLabel: cta?.label ?? "Get Started",
        primaryHref: cta?.href ?? "#offer",
        secondaryLabel: "",
        layout: imgSrc ? "split" : "centered",
      },
      imageSources: imgSrc
        ? [{ propPath: ["media"], src: imgSrc, alt: img.attr("alt")?.trim() ?? "" }]
        : [],
    };
  }

  const detailsEls = $el.find("details");
  if (detailsEls.length >= 2 || /faq|accordion|questions/.test(classes)) {
    const items: { question: string; answer: string }[] = [];
    if (detailsEls.length >= 2) {
      detailsEls.each((_, d) => {
        const q = $(d).find("summary").first().text().replace(/\s+/g, " ").trim();
        const clone = $(d).clone();
        clone.find("summary").remove();
        const a = clone.text().replace(/\s+/g, " ").trim();
        if (q && a) items.push({ question: q.slice(0, 160), answer: a.slice(0, 600) });
      });
    } else {
      $el.find("h3, h4, dt").each((_, qEl) => {
        const q = textOf($, qEl);
        const next = $(qEl).next("p, dd, div");
        const a = textOf($, next[0]);
        if (q && a && items.length < 12) items.push({ question: q.slice(0, 160), answer: a.slice(0, 600) });
      });
    }
    if (items.length >= 2) {
      return {
        type: "faq",
        confidence: 0.9,
        label: `FAQ (${items.length} questions)`,
        props: { ...defaultPropsFor("faq"), heading: heading || "Frequently asked questions", items },
        imageSources: [],
      };
    }
  }

  const table = $el.find("table").first();
  if (table.length || /toplists?|compare|operator|casinos?-list|ranking/.test(classes)) {
    const rows: Record<string, unknown>[] = [];
    table.find("tbody tr, tr").each((idx, tr) => {
      const cells = $(tr)
        .find("td")
        .map((_, td) => textOf($, td))
        .get();
      if (cells.length >= 2 && rows.length < 10) {
        const link = $(tr).find("a[href]").last();
        rows.push({
          rank: rows.length + 1,
          brand: (cells[0] || `Brand ${idx + 1}`).slice(0, 48),
          bonus: (cells[1] || "Welcome offer").slice(0, 80),
          rating: cells[2] && /\d/.test(cells[2]) ? cells[2].slice(0, 12) : "9.5/10",
          payoutSpeed: cells[3]?.slice(0, 24) ?? "Fast",
          license: "Licensed",
          ctaLabel: link.text().trim().slice(0, 24) || "Visit",
          ctaHref: link.attr("href")?.trim() ?? "#",
          terms: "18+ | T&Cs apply.",
        });
      }
    });
    if (rows.length >= 1) {
      return {
        type: "casino-compare-table",
        confidence: 0.88,
        label: `Comparison table (${rows.length} rows)`,
        props: {
          ...defaultPropsFor("casino-compare-table"),
          heading: heading || "Top rated options",
          rows,
        },
        imageSources: [],
      };
    }
  }

  if (/bonus|welcome-offer|deposit-match|free-spins/.test(classes) || /\b\d{2,3}%\s*(up to|bonus|match)/i.test(fullText)) {
    const cta = firstLink($, $el);
    const match = fullText.match(/(\d{2,3}%[^.!?\n]{0,40})/i);
    const terms =
      $el.find("small, [class*='term'], [class*='fine'], [class*='disclaim']").first().text().replace(/\s+/g, " ").trim() ||
      "18+ | New customers only | T&Cs apply.";
    return {
      type: "bonus-card",
      confidence: 0.82,
      label: `Bonus offer: "${(match?.[1] ?? heading ?? "Offer").slice(0, 40)}"`,
      props: {
        ...defaultPropsFor("bonus-card"),
        brand: (heading || "Featured Offer").slice(0, 48),
        headline: (match?.[1] ?? heading ?? "Welcome Bonus").slice(0, 72),
        ctaLabel: cta?.label ?? "Claim Offer",
        ctaHref: cta?.href ?? "#",
        terms: terms.slice(0, 320),
      },
      imageSources: [],
    };
  }

  if (/18\+|gambleaware|begambleaware|responsible\s*gaming|play\s*responsibly/i.test(fullText) && fullText.length < 700) {
    return {
      type: "responsible-gaming",
      confidence: 0.91,
      label: "Responsible gaming notice",
      props: {
        ...defaultPropsFor("responsible-gaming"),
        heading: heading || "Play responsibly",
        message: fullText.slice(0, 420),
      },
      imageSources: [],
    };
  }

  if (/pricing|plans|tiers/.test(classes)) {
    const planCards = $el.find("[class*='plan'], [class*='tier'], [class*='card'], article");
    if (planCards.length >= 2) {
      const plans: Record<string, unknown>[] = [];
      planCards.slice(0, 4).each((idx, card) => {
        const $c = $(card);
        const name = $c.find("h3, h4, strong").first().text().trim() || `Plan ${idx + 1}`;
        const priceMatch = textOf($, card).match(/([$\u20ac\u00a3]\s?\d[\d.,]*)/);
        const feats = $c
          .find("li")
          .map((_, li) => textOf($, li))
          .get()
          .slice(0, 7)
          .join("\n");
        const cta = firstLink($, $c);
        plans.push({
          name: name.slice(0, 32),
          price: priceMatch?.[1] ?? "$29",
          annualPrice: priceMatch?.[1] ?? "$24",
          period: "per month",
          description: $c.find("p").first().text().trim().slice(0, 100),
          features: feats || "Core features included",
          ctaLabel: cta?.label ?? "Choose",
          ctaHref: cta?.href ?? "#",
          featured: idx === 1,
        });
      });
      return {
        type: "pricing-table",
        confidence: 0.84,
        label: `Pricing table (${plans.length} plans)`,
        props: { ...defaultPropsFor("pricing-table"), heading: heading || "Plans", plans },
        imageSources: [],
      };
    }
  }

  const ol = $el.find("ol").first();
  if (ol.length && ol.find("li").length >= 2) {
    const steps = ol
      .find("li")
      .map((_, li) => {
        const strong = $(li).find("strong, h3, h4").first().text().trim();
        const body = textOf($, li);
        return {
          title: (strong || body.slice(0, 42)).slice(0, 60),
          body: body.slice(0, 220),
        };
      })
      .get()
      .slice(0, 6);
    return {
      type: "steps",
      confidence: 0.85,
      label: `Steps (${steps.length} items)`,
      props: { ...defaultPropsFor("steps"), heading: heading || "How it works", steps },
      imageSources: [],
    };
  }

  const iframeSrc = $el.find("iframe[src]").first().attr("src")?.trim();
  if (iframeSrc && /youtube\.com|youtu\.be|vimeo\.com/i.test(iframeSrc)) {
    return {
      type: "video-embed",
      confidence: 0.9,
      label: "Embedded video",
      props: { ...defaultPropsFor("video-embed"), heading: heading || "", url: iframeSrc },
      imageSources: [],
    };
  }

  const blockCards = $el.find("article, [class*='card'], [class*='feature'], li").filter((_, c) => {
    return $(c).find("h3, h4").length > 0 && $(c).find("p").length > 0;
  });
  if (blockCards.length >= 3) {
    const items = blockCards
      .slice(0, 6)
      .map((_, c) => ({
        icon: "sparkles",
        title: $(c).find("h3, h4").first().text().replace(/\s+/g, " ").trim().slice(0, 64),
        body: $(c).find("p").first().text().replace(/\s+/g, " ").trim().slice(0, 220),
      }))
      .get();
    return {
      type: "features-grid",
      confidence: 0.78,
      label: `Features grid (${items.length} items)`,
      props: { ...defaultPropsFor("features-grid"), heading: heading || "Highlights", items },
      imageSources: [],
    };
  }

  const blockquote = $el.find("blockquote").first();
  if (blockquote.length) {
    return {
      type: "testimonial-quote",
      confidence: 0.86,
      label: "Testimonial quote",
      props: {
        ...defaultPropsFor("testimonial-quote"),
        quote: textOf($, blockquote[0]).slice(0, 320),
        author: $el.find("cite, figcaption, strong").first().text().trim().slice(0, 48) || "Customer",
        role: "",
        rating: 5,
      },
      imageSources: [],
    };
  }

  const imgs = $el.find("img[src]");
  if (imgs.length === 1 && fullText.length < 180) {
    const src = imgs.attr("src")?.trim() ?? "";
    const alt = imgs.attr("alt")?.trim() ?? "";
    return {
      type: "image",
      confidence: 0.85,
      label: `Image${alt ? `: "${alt.slice(0, 36)}"` : ""}`,
      props: {
        ...defaultPropsFor("image"),
        alt: alt || "Imported image",
        caption: $el.find("figcaption").text().trim().slice(0, 140),
      },
      imageSources: src ? [{ propPath: ["media"], src, alt }] : [],
    };
  }

  if (imgs.length >= 2) {
    const imageSources: Classification["imageSources"] = [];
    const slides = imgs
      .slice(0, 6)
      .map((idx, img) => {
        const src = $(img).attr("src")?.trim() ?? "";
        const alt = $(img).attr("alt")?.trim() ?? `Slide ${idx + 1}`;
        if (src) imageSources.push({ propPath: ["slides", String(idx), "media"], src, alt });
        return { caption: alt.slice(0, 80), href: "" };
      })
      .get();
    return {
      type: "carousel",
      confidence: 0.72,
      label: `Image carousel (${slides.length} slides)`,
      props: { ...defaultPropsFor("carousel"), heading: heading || "", slides },
      imageSources,
    };
  }

  const cta = firstLink($, $el);
  if (cta && heading && fullText.length < 360) {
    return {
      type: "cta-banner",
      confidence: 0.76,
      label: `Call-to-action banner: "${heading.slice(0, 40)}"`,
      props: {
        ...defaultPropsFor("cta-banner"),
        heading: heading.slice(0, 120),
        body: $el.find("p").first().text().replace(/\s+/g, " ").trim().slice(0, 220),
        buttonLabel: cta.label,
        buttonHref: cta.href,
      },
      imageSources: [],
    };
  }

  const innerHtml = sanitizeRichHtml($el.html() ?? "");
  if (innerHtml && fullText.length >= 20) {
    return {
      type: "rich-text",
      confidence: 0.62,
      label: heading ? `Text section: "${heading.slice(0, 40)}"` : `Text section (${fullText.slice(0, 36)}...)`,
      props: { ...defaultPropsFor("rich-text"), html: innerHtml },
      imageSources: [],
    };
  }

  return {
    type: null,
    confidence: 0.2,
    label: `Unrecognized <${tag}> region`,
    props: {},
    imageSources: [],
  };
}

async function classifyAmbiguousWithLlm(
  segments: ImportSegment[],
): Promise<void> {
  const adapter = (
    process.env.LLM_ADAPTER ??
    (await getSettingString("importer.llm_adapter", "none"))
  )
    .trim()
    .toLowerCase();
  if (adapter === "none" || !adapter) return;

  const ambiguous = segments.filter((s) => s.confidence < 0.6 || !s.suggestedType);
  if (ambiguous.length === 0) return;

  const baseUrl = (
    process.env.LLM_BASE_URL ??
    (await getSettingString("importer.llm_base_url", ""))
  ).trim();
  const apiKey = (
    process.env.LLM_API_KEY ??
    (await getSettingSecret("importer.llm_api_key")) ??
    ""
  ).trim();
  const model = (
    process.env.LLM_MODEL ??
    (await getSettingString("importer.llm_model", "gpt-4o-mini"))
  ).trim();

  if (!baseUrl || !apiKey) return;

  const allowedTypes = COMPONENT_LIST.filter((c) => !c.adminOnly).map((c) => c.type);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `Classify each HTML excerpt into one of these component types: ${allowedTypes.join(", ")}. Respond with JSON {"items":[{"id":"...","suggestedType":"...","confidence":0.75}]}.`,
          },
          {
            role: "user",
            content: JSON.stringify(
              ambiguous.map((s) => ({
                id: s.id,
                tag: s.sourceTag,
                excerpt: s.excerpt,
              })),
            ),
          },
        ],
      }),
    });
    if (!response.ok) return;
    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return;
    const parsed = JSON.parse(content) as {
      items?: { id?: string; suggestedType?: string; confidence?: number }[];
    };
    for (const item of parsed.items ?? []) {
      if (!item.id || !item.suggestedType || !allowedTypes.includes(item.suggestedType)) {
        continue;
      }
      const target = segments.find((s) => s.id === item.id);
      if (!target) continue;
      target.suggestedType = item.suggestedType;
      target.confidence = Math.min(0.85, Math.max(0.5, Number(item.confidence ?? 0.7)));
      target.decision = "accept";
      target.props = {
        ...defaultPropsFor(item.suggestedType),
        ...(item.suggestedType === "rich-text" && target.rawHtml
          ? { html: sanitizeRichHtml(target.rawHtml) }
          : {}),
      };
    }
  } catch {
    // Any LLM timeout or parse issue cleanly leaves deterministic results intact.
  } finally {
    clearTimeout(timer);
  }
}

function setAtPath(target: Record<string, unknown>, path: string[], value: unknown) {
  let cursor: unknown = target;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    if (Array.isArray(cursor)) cursor = cursor[Number(key)];
    else if (cursor && typeof cursor === "object") cursor = (cursor as Record<string, unknown>)[key];
  }
  const last = path[path.length - 1];
  if (cursor && typeof cursor === "object" && !Array.isArray(cursor)) {
    (cursor as Record<string, unknown>)[last] = value;
  }
}

export async function analyzeHtml(
  rawHtml: string,
  options: AnalyzeOptions = {},
): Promise<{
  report: ImportReport;
  seo: PageSeo;
  title: string;
}> {
  const byteLen = Buffer.byteLength(rawHtml, "utf8");
  if (byteLen === 0) throw new ValidationError("Upload or paste an HTML document first.");
  if (byteLen > MAX_HTML_BYTES) {
    throw new ValidationError(
      `HTML imports are capped at 5 MB; this file is ${(byteLen / (1024 * 1024)).toFixed(1)} MB.`,
    );
  }

  const $ = cheerio.load(rawHtml);
  const head = parseHead($);
  const { strippedCount, warnings } = stripNoise($);
  const regions = topLevelRegions($);

  const segments: ImportSegment[] = [];
  let mapped = 0;
  let unmapped = 0;
  let imagesImported = 0;
  let imagesSkipped = 0;

  for (let i = 0; i < regions.length; i += 1) {
    const el = regions[i];
    const classified = classifyRegion($, el, i);
    const excerpt = textOf($, el).slice(0, 180);
    const rawSegmentHtml = $.html(el).slice(0, 24_000);
    const props = structuredClone(classified.props);

    for (const imgRef of classified.imageSources) {
      if (imgRef.src.startsWith("data:image/")) {
        const match = imgRef.src.match(/^data:(image\/[a-z+]+);base64,([a-z0-9+/=\s]+)$/i);
        if (match && options.siteId && options.actor) {
          const bytes = Buffer.from(match[2], "base64");
          if (bytes.length <= MAX_REMOTE_IMAGE_BYTES) {
            try {
              const { asset } = await uploadMedia({
                siteId: options.siteId,
                filename: "inline-image",
                mimeType: match[1].toLowerCase(),
                bytes,
                altText: imgRef.alt,
                actor: options.actor,
              });
              setAtPath(props, imgRef.propPath, { id: asset.id, alt: imgRef.alt });
              imagesImported += 1;
              continue;
            } catch {
              imagesSkipped += 1;
            }
          }
        }
        imagesSkipped += 1;
      } else if (
        options.fetchRemoteImages &&
        options.siteId &&
        options.actor &&
        isSafeRemoteUrl(imgRef.src)
      ) {
        const fetched = await safeFetchBytes(imgRef.src, MAX_REMOTE_IMAGE_BYTES);
        if (fetched) {
          try {
            const urlObj = new URL(imgRef.src);
            const filename = urlObj.pathname.split("/").pop() || "imported-image";
            const { asset } = await uploadMedia({
              siteId: options.siteId,
              filename,
              mimeType: "application/octet-stream",
              bytes: fetched,
              altText: imgRef.alt,
              actor: options.actor,
            });
            setAtPath(props, imgRef.propPath, { id: asset.id, alt: imgRef.alt });
            imagesImported += 1;
          } catch {
            imagesSkipped += 1;
          }
        } else {
          imagesSkipped += 1;
        }
      } else {
        imagesSkipped += 1;
      }
    }

    if (classified.type) mapped += 1;
    else unmapped += 1;

    segments.push({
      id: `seg-${i + 1}`,
      index: i,
      label: classified.label,
      sourceTag: el.tagName.toLowerCase(),
      excerpt,
      rawHtml: rawSegmentHtml,
      suggestedType: classified.type,
      confidence: classified.confidence,
      props,
      decision: classified.type ? "accept" : "skip",
    });
  }

  await classifyAmbiguousWithLlm(segments);

  mapped = segments.filter((s) => Boolean(s.suggestedType)).length;
  unmapped = segments.length - mapped;

  if (imagesSkipped > 0 && !options.fetchRemoteImages) {
    warnings.push(
      `${imagesSkipped} external image reference${imagesSkipped === 1 ? "" : "s"} left as placeholders so you can pick replacements from the media library.`,
    );
  }

  const seo: PageSeo = {
    metaTitle: head.title.slice(0, 70),
    metaDescription: head.description.slice(0, 170),
    ogTitle: head.ogTitle.slice(0, 70) || undefined,
    ogDescription: head.ogDescription.slice(0, 170) || undefined,
    canonicalUrl: head.canonical || undefined,
    noindex: head.noindex,
  };

  return {
    title: head.title,
    seo,
    report: {
      title: head.title,
      mappedCount: mapped,
      unmappedCount: unmapped,
      strippedCount,
      imagesImported,
      imagesSkipped,
      warnings,
      segments,
    },
  };
}

export async function createImportJob(options: {
  siteId: string;
  filename: string;
  html: string;
  targetPageId?: string | null;
  fetchRemoteImages?: boolean;
  actor: Actor;
}): Promise<ImportJob> {
  await ensureDb();
  const maxPerDay = await getSettingNumber("limits.imports_per_day", 20);
  const daily = await consumeRateLimit("import-daily", options.actor.user.id, maxPerDay, 86_400);
  if (!daily.allowed) {
    throw new RateLimitError(
      `Import limit reached (${maxPerDay} HTML imports per day). Try again tomorrow.`,
      daily.retryAfterSeconds,
    );
  }

  const { asset: sourceAsset } = await uploadMedia({
    siteId: options.siteId,
    filename: options.filename || "import.html",
    mimeType: "text/html",
    bytes: Buffer.from(options.html, "utf8"),
    actor: options.actor,
    kindOverride: "import_reference",
  });

  const { report } = await analyzeHtml(options.html, {
    fetchRemoteImages: options.fetchRemoteImages,
    siteId: options.siteId,
    actor: options.actor,
  });

  const [job] = await db
    .insert(importJobs)
    .values({
      siteId: options.siteId,
      targetPageId: options.targetPageId ?? null,
      status: "review",
      sourceFilename: options.filename || "pasted.html",
      sourceMediaId: sourceAsset.id,
      sourceSizeBytes: Buffer.byteLength(options.html, "utf8"),
      extractedMeta: {
        title: report.title,
      },
      report,
      createdBy: options.actor.user.id,
    })
    .returning();

  await recordAudit({
    action: "import_analyzed",
    summary: `Analyzed "${job.sourceFilename}" (${report.mappedCount} mapped, ${report.unmappedCount} unmapped)`,
    siteId: options.siteId,
    actor: options.actor,
    targetType: "import",
    targetId: job.id,
  });

  return job;
}

export type SegmentDecisionInput = {
  id: string;
  decision: "accept" | "remap" | "skip" | "raw_html";
  remapType?: string;
};

export async function applyImportJob(options: {
  siteId: string;
  jobId: string;
  decisions: SegmentDecisionInput[];
  pageTitle?: string;
  pageSlug?: string;
  actor: Actor;
}): Promise<{ pageId: string; blockCount: number }> {
  await ensureDb();
  const [job] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, options.jobId), eq(importJobs.siteId, options.siteId)))
    .limit(1);
  if (!job || !job.report) throw new NotFoundError("Import session not found.");
  assertTransition(
    "import",
    job.status,
    "applied",
    "This import session has already been applied or discarded.",
  );

  const decisionById = new Map(options.decisions.map((d) => [d.id, d]));
  const validTypes = new Set(COMPONENT_LIST.map((c) => c.type));
  const adminBlockTypes = new Set(
    COMPONENT_LIST.filter((c) => c.adminOnly).map((c) => c.type),
  );
  const blocks: BlockNode[] = [];

  for (const seg of job.report.segments) {
    const decision = decisionById.get(seg.id);
    const action = decision?.decision ?? seg.decision;
    if (action === "skip") continue;

    if (action === "raw_html") {
      if (!can(options.actor, "catalog.admin_blocks")) {
        throw new ForbiddenError(
          "Only administrators can convert imported regions into raw HTML blocks.",
        );
      }
      blocks.push({
        type: "raw-html",
        props: {
          ...defaultPropsFor("raw-html"),
          id: newBlockId("raw-html"),
          title: seg.label.slice(0, 60),
          html: seg.rawHtml || `<p>${seg.excerpt}</p>`,
        },
      });
      continue;
    }

    const chosenType =
      action === "remap" && decision?.remapType && validTypes.has(decision.remapType)
        ? decision.remapType
        : seg.suggestedType;

    if (!chosenType || !validTypes.has(chosenType)) continue;

    if (adminBlockTypes.has(chosenType) && !can(options.actor, "catalog.admin_blocks")) {
      throw new ForbiddenError(
        `Only administrators can place the "${chosenType}" block during import.`,
      );
    }

    let props: Record<string, unknown>;
    if (chosenType === seg.suggestedType) {
      props = { ...defaultPropsFor(chosenType), ...seg.props };
    } else if (chosenType === "rich-text") {
      props = {
        ...defaultPropsFor("rich-text"),
        html: seg.rawHtml ? sanitizeRichHtml(seg.rawHtml) : `<p>${seg.excerpt}</p>`,
      };
    } else {
      props = { ...defaultPropsFor(chosenType) };
      if ("heading" in props && seg.label) props.heading = seg.label.slice(0, 80);
      if ("headline" in props && seg.label) props.headline = seg.label.slice(0, 80);
      if ("body" in props && seg.excerpt) props.body = seg.excerpt;
    }

    blocks.push({
      type: chosenType,
      props: { ...props, id: newBlockId(chosenType) },
    });
  }

  const document: PageDocument = {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    root: { props: {} },
    content: blocks,
  };

  let pageId = job.targetPageId;
  const title = (options.pageTitle || job.report.title || "Imported Page").trim();

  if (pageId) {
    const existing = await db.query.pages.findFirst({
      where: (t, { eq: e }) => e(t.id, pageId!),
    });
    if (!existing) throw new NotFoundError("Target page no longer exists.");
    await savePageDraft({
      siteId: options.siteId,
      pageId,
      expectedLockVersion: existing.lockVersion,
      title,
      document,
      actor: options.actor,
    });
  } else {
    const slug = normalizePath(options.pageSlug || title);
    const created = await createPage({
      siteId: options.siteId,
      title,
      slug,
      document,
      seo: { metaTitle: title.slice(0, 70) },
      actor: options.actor,
    });
    pageId = created.id;
  }

  await db
    .update(importJobs)
    .set({
      status: "applied",
      targetPageId: pageId,
      appliedAt: new Date(),
    })
    .where(eq(importJobs.id, job.id));

  await recordAudit({
    action: "import_applied",
    summary: `Imported ${blocks.length} editable blocks from "${job.sourceFilename}" into "${title}"`,
    siteId: options.siteId,
    actor: options.actor,
    targetType: "page",
    targetId: pageId,
  });

  return { pageId, blockCount: blocks.length };
}

export async function discardImportJob(
  siteId: string,
  jobId: string,
  actor: Actor,
): Promise<void> {
  await ensureDb();
  const [job] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.siteId, siteId)))
    .limit(1);
  if (!job) throw new NotFoundError("Import session not found.");
  assertTransition("import", job.status, "discarded");
  await db
    .update(importJobs)
    .set({ status: "discarded" })
    .where(eq(importJobs.id, jobId));
  await recordAudit({
    action: "import_discarded",
    summary: `Discarded import session "${job.sourceFilename}"`,
    siteId,
    actor,
    targetType: "import",
    targetId: jobId,
  });
}

export async function getImportJob(siteId: string, jobId: string): Promise<ImportJob | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.siteId, siteId)))
    .limit(1);
  return row ?? null;
}

export const listSiteImports = listImportJobs;
export type { ImportReport, ImportSegment } from "@/lib/documents";

export async function listImportJobs(siteId: string): Promise<ImportJob[]> {
  await ensureDb();
  return db
    .select()
    .from(importJobs)
    .where(eq(importJobs.siteId, siteId))
    .orderBy(desc(importJobs.createdAt))
    .limit(20);
}
