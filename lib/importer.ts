import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { importJobs, type ImportJob } from "@/lib/db/schema";
import type {
  ImportMapping,
  ImportReview,
  ImportReviewDecision,
  ImportSegment,
  PageDocument,
} from "@/lib/documents";
import { DOCUMENT_SCHEMA_VERSION, DEFAULT_ROOT_PROPS } from "@/lib/documents";
import { BLOCKS, validateDocument, defaultPropsFor } from "@/lib/registry";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { uploadMedia, sniffMime, MAX_IMAGE_BYTES } from "@/lib/media";
import { createPage } from "@/lib/pages";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

type Loaded = cheerio.CheerioAPI;

function clean(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function isElement(node: AnyNode): node is Element {
  return (node as Element).type === "tag";
}

function resolveUrl(raw: string | undefined, base?: string): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, base ?? "https://example.invalid");
    if (!/^https?:$/.test(url.protocol)) return null;
    if (!base) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function collectButtons($: Loaded, el: cheerio.Cheerio<Element>) {
  return el
    .find("a")
    .toArray()
    .map((anchor) => {
      const node = $(anchor);
      const label = clean(node.text());
      const className = node.attr("class") ?? "";
      const looksLikeButton = /btn|button|cta/i.test(className);
      if (!label || label.length > 48) return null;
      if (!looksLikeButton && !node.attr("role")) return null;
      return { label, href: node.attr("href") ?? "#" };
    })
    .filter((value): value is { label: string; href: string } => !!value);
}

function collectImages($: Loaded, el: cheerio.Cheerio<Element>) {
  const urls: string[] = [];
  el.find("img").each((_, img) => {
    const src = $(img).attr("src") ?? $(img).attr("data-src");
    if (src) urls.push(src);
  });
  el.find("[style]").each((_, node) => {
    const style = $(node).attr("style") ?? "";
    const match = /url\((['"]?)(.*?)\1\)/.exec(style);
    if (match?.[2]) urls.push(match[2]);
  });
  return urls;
}

function repeatCount($: Loaded, el: cheerio.Cheerio<Element>): number {
  const children = el.children().toArray().filter(isElement);
  const signatures = new Map<string, number>();
  for (const child of children) {
    const signature = `${child.tagName}:${$(child).find("h2,h3,h4").length > 0}`;
    signatures.set(signature, (signatures.get(signature) ?? 0) + 1);
  }
  return Math.max(0, ...signatures.values());
}

function shapeOf($: Loaded, el: cheerio.Cheerio<Element>) {
  return {
    tag: el.get(0)?.tagName ?? "div",
    headings: el
      .find("h1,h2,h3,h4")
      .toArray()
      .map((node) => clean($(node).text()))
      .filter(Boolean),
    paragraphs: el.find("p").length,
    buttons: collectButtons($, el).length,
    images: collectImages($, el).length,
    repeatedChildren: repeatCount($, el),
  };
}

const PAYMENT_WORDS = /(visa|mastercard|paypal|skrill|neteller|bitcoin|crypto|apple pay|google pay)/i;
const BONUS_WORDS = /(bonus|free spins|wagering|welcome offer|deposit)/i;
const TRUST_WORDS = /(18\+|licensed|licence|licensed and regulated|responsible|gamble aware|rg)/i;
const PRICING_WORDS = /(\$\d|€\d|£\d)\s*(\/|per\s*)?(mo|month|year|yr)?/i;

function priceFrom(text: string): string {
  const match = /([$€£]\s?\d[\d,.]*)/.exec(text);
  return match ? match[1] : "";
}

function ratingFrom(text: string): number {
  const match = /(\d(?:\.\d)?)\s*(?:\/\s*5|out of 5|stars?)/i.exec(text);
  if (match) return Math.min(5, Number(match[1]));
  return 0;
}

type Classification = {
  alias: string;
  confidence: number;
  props: Record<string, unknown>;
  reason: string;
};

/**
 * Deterministic signature pass (phase 2 research, step 4). It may only emit
 * aliases that exist in the registry; anything it cannot classify goes to the
 * unmapped list for a human.
 */
function classify($: Loaded, el: cheerio.Cheerio<Element>, index: number, isLast: boolean): Classification | null {
  const shape = shapeOf($, el);
  const text = clean(el.text());
  const heading = shape.headings[0] ?? "";
  const buttons = collectButtons($, el);
  const images = collectImages($, el);
  const button = buttons[0];

  if (shape.repeatedChildren >= 3 && el.find("h2,h3,h4").length >= 3 && el.find("p").length >= 3) {
    if (PRICING_WORDS.test(text) && /plan|pricing|tier/i.test(text + heading)) {
      const plans = el
        .children()
        .toArray()
        .filter(isElement)
        .map((node) => {
          const card = $(node);
          return {
            name: clean(card.find("h2,h3,h4").first().text()),
            monthlyPrice: priceFrom(clean(card.text())),
            yearlyPrice: priceFrom(clean(card.text())),
            period: "/month",
            features: card
              .find("li")
              .toArray()
              .map((li) => clean($(li).text()))
              .join("\n"),
            ctaLabel: clean(card.find("a").first().text()) || "Choose plan",
            ctaHref: card.find("a").first().attr("href") ?? "#",
            featured: "no",
          };
        })
        .filter((plan) => plan.name);
      return {
        alias: "pricing-table",
        confidence: 0.62,
        props: { ...defaultPropsFor("pricing-table"), title: heading, plans },
        reason: "Repeated cards with prices and feature lists.",
      };
    }

    const cards = el
      .children()
      .toArray()
      .filter(isElement)
      .slice(0, 4)
      .map((node) => {
        const card = $(node);
        return {
          image: images[0] ? { id: images[0] } : null,
          icon: "spark",
          title: clean(card.find("h2,h3,h4").first().text()),
          text: clean(card.find("p").first().text()),
          ctaLabel: clean(card.find("a").first().text()),
          ctaHref: card.find("a").first().attr("href") ?? "",
        };
      })
      .filter((card) => card.title);
    if (cards.length >= 3) {
      return {
        alias: "cards-grid",
        confidence: 0.7,
        props: {
          ...defaultPropsFor("cards-grid"),
          title: heading,
          columns: cards.length >= 4 ? "4" : "3",
          cards,
        },
        reason: `${cards.length} repeated cards with a heading and text.`,
      };
    }
  }

  if (el.find("details").length >= 2 || (shape.repeatedChildren >= 2 && /\?$/.test(shape.headings.join(" ")))) {
    const items = el
      .find("details")
      .toArray()
      .map((node) => ({
        question: clean($(node).find("summary").text()),
        answer: clean($(node).find("p").last().text()),
      }))
      .filter((item) => item.question);
    if (items.length >= 2) {
      return {
        alias: "faq",
        confidence: 0.85,
        props: { ...defaultPropsFor("faq"), title: heading || "Frequently asked", items },
        reason: "Question and answer pairs.",
      };
    }
  }

  if (el.find("table").length && el.find("tr").length >= 3) {
    const headerCells = el.find("tr").first().find("th,td").toArray().map((cell) => clean($(cell).text()));
    const rows = el
      .find("tr")
      .toArray()
      .slice(1)
      .map((tr) => {
        const cells = $(tr).find("td").toArray().map((cell) => clean($(cell).text()));
        return {
          casino: cells[0] ?? "",
          bonus: cells[1] ?? "",
          highlights: cells[2] ?? "",
          rating: ratingFrom(cells.join(" ")),
          ctaLabel: clean($(tr).find("a").first().text()) || "Claim",
          ctaHref: $(tr).find("a").first().attr("href") ?? "#",
          highlight: "no",
        };
      })
      .filter((row) => row.casino);
    return {
      alias: "casino-compare-table",
      confidence: 0.8,
      props: {
        ...defaultPropsFor("casino-compare-table"),
        title: heading || "Compare",
        columns: headerCells.length >= 3 ? headerCells : ["Casino", "Welcome bonus", "Highlights", "Rating"],
        rows,
      },
      reason: "A data table with three or more rows.",
    };
  }

  if (shape.headings.length >= 2 && shape.paragraphs >= 3 && PRICING_WORDS.test(text)) {
    return {
      alias: "pricing-table",
      confidence: 0.4,
      props: { ...defaultPropsFor("pricing-table"), title: heading },
      reason: "Prices found, but the card structure was ambiguous.",
    };
  }

  if (shape.repeatedChildren >= 3 && el.find("ol, ul").length && shape.paragraphs >= 2 && !button) {
    const items = el
      .find("li")
      .toArray()
      .slice(0, 8)
      .map((li) => {
        const label = clean($(li).find("h2,h3,h4,strong").first().text()) || clean($(li).text()).slice(0, 60);
        const rest = clean($(li).text()).replace(label, "").trim();
        return { title: label, text: rest.slice(0, 160) };
      })
      .filter((item) => item.title);
    if (items.length >= 3) {
      return {
        alias: "steps",
        confidence: 0.66,
        props: { ...defaultPropsFor("steps"), title: heading || "How it works", items },
        reason: "An ordered list of three or more steps.",
      };
    }
  }

  if (BONUS_WORDS.test(text) && /(100%|up to|free spins)/i.test(text) && shape.headings.length <= 2) {
    const terms = /(\d+x\s*wagering[^.]*)/i.exec(text)?.[1] ?? "";
    return {
      alias: "bonus-card",
      confidence: 0.58,
      props: {
        ...defaultPropsFor("bonus-card"),
        headline: heading || /(100%\s*up to\s*[$€£]?\d+)/i.exec(text)?.[1] || "Welcome bonus",
        subline: clean(el.find("p").first().text()).slice(0, 140),
        terms: terms || "Terms apply. 18+.",
        cta: button ? { label: button.label, href: button.href, style: "solid" } : undefined,
        rating: ratingFrom(text),
      },
      reason: "Bonus wording with wagering terms.",
    };
  }

  if (PAYMENT_WORDS.test(text) && text.length < 400) {
    const methods = [...text.matchAll(new RegExp(PAYMENT_WORDS.source, "gi"))]
      .map((match) => match[1])
      .filter((value, i, all) => all.indexOf(value) === i);
    return {
      alias: "payment-strip",
      confidence: 0.6,
      props: { ...defaultPropsFor("payment-strip"), methods },
      reason: "Payment method names in a short strip.",
    };
  }

  if (TRUST_WORDS.test(text) && text.length < 600 && shape.headings.length <= 2) {
    return {
      alias: "trust-strip",
      confidence: 0.5,
      props: { ...defaultPropsFor("trust-strip"), text: text.slice(0, 200) },
      reason: "Licence and responsible-play wording.",
    };
  }

  if (el.find("iframe").length || /youtube\.com|youtu\.be|vimeo\.com/.test(text)) {
    const html = $.html(el);
    const id =
      /youtube(?:-nocookie)?\.com\/embed\/([\w-]+)/.exec(html)?.[1] ??
      /youtu\.be\/([\w-]+)/.exec(html)?.[1] ??
      /vimeo\.com\/(\d+)/.exec(html)?.[1] ??
      "";
    return {
      alias: "video-embed",
      confidence: 0.75,
      props: {
        ...defaultPropsFor("video-embed"),
        provider: /vimeo/.test(html) ? "vimeo" : "youtube",
        videoId: id,
        title: heading || "Video",
      },
      reason: "An embedded video player.",
    };
  }

  if (index === 0 && (el.find("h1").length > 0 || shape.headings.length > 0) && button) {
    return {
      alias: "hero",
      confidence: 0.72,
      props: {
        ...defaultPropsFor("hero"),
        eyebrow: "",
        title: clean(el.find("h1").first().text()) || heading,
        subtitle: clean(el.find("p").first().text()).slice(0, 240),
        primary: { label: button.label, href: button.href, style: "solid" },
        secondary: buttons[1]
          ? { label: buttons[1].label, href: buttons[1].href, style: "outline" }
          : { label: "", href: "", style: "outline" },
        background: images[0] ? { id: images[0] } : null,
      },
      reason: "First section with the page headline and a button.",
    };
  }

  if (isLast && heading && button) {
    return {
      alias: "cta-banner",
      confidence: 0.55,
      props: {
        ...defaultPropsFor("cta-banner"),
        title: heading,
        text: clean(el.find("p").first().text()).slice(0, 200),
        primary: { label: button.label, href: button.href, style: "solid" },
      },
      reason: "Closing section with a heading and a button.",
    };
  }

  if (shape.images >= 2 && shape.headings.length === 0) {
    return {
      alias: "carousel",
      confidence: 0.45,
      props: {
        ...defaultPropsFor("carousel"),
        slides: images.slice(0, 5).map((image) => ({
          image: { id: image },
          title: "",
          text: "",
          ctaLabel: "",
          ctaHref: "",
        })),
      },
      reason: "Several images with no text, likely a gallery.",
    };
  }

  if (shape.images === 1 && shape.headings.length === 0 && shape.paragraphs <= 1) {
    return {
      alias: "image",
      confidence: 0.6,
      props: {
        ...defaultPropsFor("image"),
        image: { id: images[0] },
        alt: clean(el.find("img").first().attr("alt") ?? ""),
      },
      reason: "A single image.",
    };
  }

  if (heading || shape.paragraphs > 0) {
    const body = el
      .find("p")
      .toArray()
      .map((node) => clean($(node).text()))
      .filter(Boolean)
      .join("\n\n");
    return {
      alias: "rich-text",
      confidence: 0.5,
      props: {
        ...defaultPropsFor("rich-text"),
        heading,
        body: body.slice(0, 1200) || text.slice(0, 800),
      },
      reason: "Headings and paragraphs without a stronger signature.",
    };
  }

  return null;
}

function topLevelSections($: Loaded): cheerio.Cheerio<Element>[] {
  const body = $("body");
  const roots = body.children().toArray().filter(isElement);
  const sections: Element[] = [];
  for (const root of roots) {
    const tag = (root as Element).tagName;
    const hasMeaningfulText = clean($(root).text()).length > 30 || $(root).find("img").length > 0;
    if (!hasMeaningfulText) continue;
    if (["main", "div", "section", "article", "body"].includes(tag)) {
      const children = $(root).children().toArray().filter(isElement);
      if (children.length > 2) sections.push(...children);
      else sections.push(root as Element);
    } else {
      sections.push(root as Element);
    }
  }
  return sections.map((element) => $(element));
}

export function analyzeHtml(html: string): ImportMapping {
  const $ = cheerio.load(html);
  $("script, style, noscript, template").remove();
  // Site chrome is global content, not page content.
  $("header, nav, footer").each((_, node) => {
    $(node).remove();
  });

  const candidates = topLevelSections($).filter((el) => clean(el.text()).length > 0 || el.find("img").length > 0);

  const palette = new Set<string>();
  const rawHtml = $.html();
  for (const match of rawHtml.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    palette.add(match[0].toLowerCase());
    if (palette.size >= 6) break;
  }

  const segments: ImportSegment[] = [];
  const unmapped: ImportMapping["unmapped"] = [];

  candidates.forEach((el, index) => {
    const classification = classify($, el, index, index === candidates.length - 1);
    const assetUrls = collectImages($, el);
    const shape = shapeOf($, el);
    const excerpt = clean(el.text()).slice(0, 220);

    if (!classification || !BLOCKS[classification.alias]) {
      unmapped.push({
        index,
        label: shape.headings[0] ?? `Section ${index + 1}`,
        excerpt,
        reason: "No signature matched with enough confidence.",
      });
      return;
    }

    segments.push({
      id: `seg-${index + 1}`,
      index,
      label: shape.headings[0] ?? `Section ${index + 1}`,
      excerpt,
      shape,
      proposedAlias: classification.alias,
      confidence: Math.round(classification.confidence * 100) / 100,
      props: classification.props,
      assetUrls,
      reason: classification.reason,
    });
  });

  const title = clean($("title").first().text()) || shapeOf($, $("body")).headings[0] || "Imported page";

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    method: "deterministic",
    segments,
    unmapped,
    palette: [...palette],
    pageTitle: title.slice(0, 120),
    counts: { sections: candidates.length, mapped: segments.length, unmapped: unmapped.length },
  };
}

/* --------------------------- asset copying (SSRF rules) --------------------------- */

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
];

export function isSafeRemoteUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (PRIVATE_RANGES.some((pattern) => pattern.test(host))) return false;
  return true;
}

async function fetchImage(url: string): Promise<Buffer | null> {
  if (!isSafeRemoteUrl(url)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "image/*" },
    });
    if (!response.ok) return null;
    const length = Number(response.headers.get("content-length") ?? 0);
    if (length && length > MAX_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) return null;
    const sniffed = sniffMime(buffer);
    if (!sniffed?.mime.startsWith("image/")) return null;
    return buffer;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------- job lifecycle ------------------------------- */

export async function createImportJob(options: {
  siteId: string;
  filename: string;
  bytes: Buffer;
  actor: Actor;
}): Promise<ImportJob> {
  await ensureDb();
  if (options.bytes.length > MAX_IMPORT_BYTES) throw new Error("Import files are capped at 5 MB.");
  const sniffed = sniffMime(options.bytes);
  if (!sniffed || !["text/html", "image/svg+xml"].includes(sniffed.mime)) {
    throw new Error("Upload a single HTML file (the bytes are inspected, not the file name).");
  }

  const { asset } = await uploadMedia({
    siteId: options.siteId,
    bytes: options.bytes,
    filename: options.filename,
    actor: options.actor,
    kind: "import_reference",
    altText: `Imported source: ${options.filename}`,
  });

  const html = options.bytes.toString("utf8");
  const mapping = analyzeHtml(html);

  const [job] = await db
    .insert(importJobs)
    .values({
      siteId: options.siteId,
      status: "in_review",
      sourceName: options.filename,
      fileMediaId: asset.id,
      mappingResult: mapping,
      createdBy: options.actor.user.id,
    })
    .returning();

  await recordAudit({
    action: "import_mapped",
    summary: `Mapped “${options.filename}”: ${mapping.counts.mapped} of ${mapping.counts.sections} sections recognised`,
    siteId: options.siteId,
    actor: options.actor,
    targetType: "import_job",
    targetId: job.id,
  });

  return job;
}

export async function getImportJob(siteId: string, jobId: string): Promise<ImportJob | null> {
  await ensureDb();
  const [job] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, jobId), eq(importJobs.siteId, siteId)))
    .limit(1);
  return job ?? null;
}

export async function listImportJobs(siteId: string): Promise<ImportJob[]> {
  await ensureDb();
  return db.select().from(importJobs).where(eq(importJobs.siteId, siteId)).orderBy(importJobs.createdAt);
}

async function copySegmentAssets(
  segment: ImportSegment,
  siteId: string,
  actor: Actor,
): Promise<{ props: Record<string, unknown>; copied: number }> {
  const props = structuredClone(segment.props);
  let copied = 0;

  const replaceInValue = async (value: unknown): Promise<unknown> => {
    if (Array.isArray(value)) {
      const out = [];
      for (const item of value) out.push(await replaceInValue(item));
      return out;
    }
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.id === "string" && /^https?:\/\//.test(record.id)) {
        const bytes = await fetchImage(record.id);
        if (bytes) {
          const { asset } = await uploadMedia({
            siteId,
            bytes,
            filename: record.id.split("/").pop()?.split("?")[0] ?? "imported",
            actor,
            altText: typeof record.alt === "string" ? record.alt : undefined,
            originalUrl: record.id,
          });
          copied += 1;
          return { id: asset.id };
        }
        return null;
      }
      const out: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(record)) out[key] = await replaceInValue(item);
      return out;
    }
    return value;
  };

  return { props: (await replaceInValue(props)) as Record<string, unknown>, copied };
}

export async function applyImportJob(options: {
  siteId: string;
  jobId: string;
  decisions: ImportReviewDecision[];
  title: string;
  slug: string;
  actor: Actor;
}): Promise<{ pageId: string; copiedAssets: number }> {
  await ensureDb();
  const job = await getImportJob(options.siteId, options.jobId);
  if (!job) throw new Error("Import job not found.");
  if (job.status !== "in_review" && job.status !== "mapped") {
    throw new Error("This import is not waiting for review.");
  }
  const mapping = job.mappingResult;
  if (!mapping) throw new Error("This import has no mapping yet.");

  const content: PageDocument["content"] = [];
  let copiedAssets = 0;

  try {
    for (const decision of options.decisions) {
      if (decision.decision === "removed") continue;
      const segment = mapping.segments.find((item) => item.id === decision.segmentId);
      if (!segment) continue;
      const alias = decision.alias && BLOCKS[decision.alias] ? decision.alias : segment.proposedAlias;
      const definition = BLOCKS[alias];
      if (!definition) continue;

      const sourceProps = decision.props ?? segment.props;
      const { props, copied } = await copySegmentAssets({ ...segment, props: sourceProps }, options.siteId, options.actor);
      copiedAssets += copied;

      const parsed = definition.schema.safeParse({ ...defaultPropsFor(alias), ...props });
      if (!parsed.success) continue;
      content.push({ type: alias, props: parsed.data as PageDocument["content"][number]["props"] });
    }

    if (!content.length) {
      throw new Error("Nothing was kept in the review, so no page was created.");
    }

    const document: PageDocument = {
      schemaVersion: DOCUMENT_SCHEMA_VERSION,
      root: { props: { ...DEFAULT_ROOT_PROPS } },
      content,
    };
    const validation = validateDocument(document);
    if (!validation.ok) throw new Error(validation.errors.join(" "));

    const page = await createPage({
      siteId: options.siteId,
      title: options.title || mapping.pageTitle,
      slug: options.slug || mapping.pageTitle,
      document: validation.document,
      actor: options.actor,
      source: "import",
      seo: { canonicalMode: "self", noindex: false },
    });

    const review: ImportReview = {
      decisions: options.decisions,
      reviewerId: options.actor.user.id,
      reviewerName: options.actor.user.name,
      reviewedAt: new Date().toISOString(),
    };

    await db
      .update(importJobs)
      .set({
        status: "applied",
        reviewResult: review,
        producedPageId: page.id,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, job.id));

    await recordAudit({
      action: "import_applied",
      summary: `Applied import “${job.sourceName}” as the draft “${page.title}”`,
      siteId: options.siteId,
      actor: options.actor,
      targetType: "page",
      targetId: page.id,
      detail: { jobId: job.id, copiedAssets },
    });

    return { pageId: page.id, copiedAssets };
  } catch (error) {
    await db
      .update(importJobs)
      .set({
        status: "failed",
        failureReason: error instanceof Error ? error.message : String(error),
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, job.id));
    await recordAudit({
      action: "import_failed",
      summary: `Import “${job.sourceName}” failed while applying`,
      siteId: options.siteId,
      actor: options.actor,
      targetType: "import_job",
      targetId: job.id,
    });
    throw error;
  }
}

export async function discardImportJob(siteId: string, jobId: string, actor: Actor): Promise<void> {
  await ensureDb();
  const job = await getImportJob(siteId, jobId);
  if (!job) throw new Error("Import job not found.");
  await db
    .update(importJobs)
    .set({ status: "discarded", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(importJobs.id, jobId));
  await recordAudit({
    action: "import_discarded",
    summary: `Discarded import “${job.sourceName}”`,
    siteId,
    actor,
    targetType: "import_job",
    targetId: jobId,
  });
}
