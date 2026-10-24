import "server-only";
import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { templates, type Template } from "@/lib/db/schema";
import {
  cloneDocumentWithNewIds,
  DOCUMENT_SCHEMA_VERSION,
  migrateDocument,
  newBlockId,
  type PageDocument,
} from "@/lib/documents";
import { defaultPropsFor } from "@/lib/registry";
import type { Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { getPage } from "@/lib/pages";
import { NotFoundError } from "@/lib/errors";

export function builtInTemplates(): {
  name: string;
  description: string;
  category: string;
  document: PageDocument;
}[] {
  return [
    {
      name: "iGaming Welcome Offer Lander",
      category: "Casino & Sportsbook",
      description:
        "High-converting single-offer landing page with hero, bonus card, payment trust strip, how-to-claim steps, FAQ, and responsible-gaming footer.",
      document: {
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        root: { props: {} },
        content: [
          {
            type: "promo-banner",
            props: {
              ...defaultPropsFor("promo-banner"),
              id: newBlockId("promo-banner"),
              badge: "NEW PLAYER EXCLUSIVE",
              text: "200% Deposit Match up to $500 + 100 Free Spins on Book of Aurora",
              code: "AURORA200",
            },
          },
          {
            type: "hero",
            props: {
              ...defaultPropsFor("hero"),
              id: newBlockId("hero"),
              eyebrow: "Licensed & Instant Payouts",
              headline: "Double your first deposit and spin 100 times on the house",
              subheadline:
                "Verified payouts under 8 minutes via Visa, Apple Pay, Skrill, and instant bank transfer. Transparent 30x wagering with live progress tracking.",
              primaryLabel: "Claim $500 + 100 Spins",
              primaryHref: "#bonus",
              secondaryLabel: "Read Full Terms",
              secondaryHref: "#faq",
              align: "center",
              layout: "centered",
            },
          },
          {
            type: "trust-strip",
            props: defaultPropsFor("trust-strip"),
          },
          {
            type: "bonus-card",
            props: {
              ...defaultPropsFor("bonus-card"),
              id: newBlockId("bonus-card"),
            },
          },
          {
            type: "payment-strip",
            props: defaultPropsFor("payment-strip"),
          },
          {
            type: "steps",
            props: defaultPropsFor("steps"),
          },
          {
            type: "game-grid",
            props: defaultPropsFor("game-grid"),
          },
          {
            type: "faq",
            props: defaultPropsFor("faq"),
          },
          {
            type: "responsible-gaming",
            props: defaultPropsFor("responsible-gaming"),
          },
        ],
      },
    },
    {
      name: "Operator Comparison Toplist",
      category: "Affiliate Review",
      description:
        "Ranked operator comparison table with license badges, bonus breakdown cards, editorial methodology, and compliance disclosure.",
      document: {
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        root: { props: {} },
        content: [
          {
            type: "hero",
            props: {
              ...defaultPropsFor("hero"),
              id: newBlockId("hero"),
              eyebrow: "Editorial Ranking - Updated Monthly",
              headline: "Best Fast-Payout Online Casinos Ranked by Real Withdrawal Tests",
              subheadline:
                "Every listed operator holds an active gaming license and was secret-shopped with live deposits and cash-outs.",
              primaryLabel: "Compare Top Operators",
              primaryHref: "#compare",
              secondaryLabel: "How We Score",
              secondaryHref: "#methodology",
              align: "left",
              layout: "centered",
            },
          },
          {
            type: "casino-compare-table",
            props: defaultPropsFor("casino-compare-table"),
          },
          {
            type: "features-grid",
            props: {
              ...defaultPropsFor("features-grid"),
              id: newBlockId("features-grid"),
              eyebrow: "Methodology",
              heading: "Four checks every listed brand must pass",
              columns: "2",
              items: [
                {
                  icon: "shield",
                  title: "Active Regulator License",
                  body: "We verify license numbers directly against MGA, UKGC, DGOJ, or AGCO public registers each month.",
                },
                {
                  icon: "zap",
                  title: "Timed Real-Money Cashout",
                  body: "Reviewers deposit, wager, and withdraw with e-wallets and bank rails to record actual settlement times.",
                },
                {
                  icon: "check",
                  title: "Plain-English Bonus Audit",
                  body: "Wagering multipliers, max-bet caps, and game weightings are surfaced beside every headline figure.",
                },
                {
                  icon: "clock",
                  title: "24/7 Live Support Test",
                  body: "Support queues are tested at peak weekend hours for safer-gambling and KYC responsiveness.",
                },
              ],
            },
          },
          {
            type: "faq",
            props: defaultPropsFor("faq"),
          },
          {
            type: "responsible-gaming",
            props: defaultPropsFor("responsible-gaming"),
          },
        ],
      },
    },
    {
      name: "SaaS Product Launch & Pricing",
      category: "Product & Campaign",
      description:
        "Clean product marketing page with split hero, three-column value props, monthly/annual pricing toggle, customer quote, and closing CTA.",
      document: {
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        root: { props: {} },
        content: [
          {
            type: "hero",
            props: {
              ...defaultPropsFor("hero"),
              id: newBlockId("hero"),
              eyebrow: "Campaign Launch Kit",
              headline: "Ship localized promo pages in minutes without touching code",
              subheadline:
                "Structured blocks, instant version rollback, and custom domain SSL built for high-velocity marketing teams.",
              primaryLabel: "Start Building",
              primaryHref: "#pricing",
              secondaryLabel: "See Features",
              secondaryHref: "#features",
              align: "center",
              layout: "centered",
            },
          },
          {
            type: "features-grid",
            props: defaultPropsFor("features-grid"),
          },
          {
            type: "pricing-table",
            props: defaultPropsFor("pricing-table"),
          },
          {
            type: "testimonial-quote",
            props: defaultPropsFor("testimonial-quote"),
          },
          {
            type: "cta-banner",
            props: defaultPropsFor("cta-banner"),
          },
        ],
      },
    },
  ];
}

export async function listTemplates(siteId?: string): Promise<Template[]> {
  await ensureDb();
  if (!siteId) {
    return db.select().from(templates).orderBy(asc(templates.category), asc(templates.name));
  }
  return db
    .select()
    .from(templates)
    .where(or(isNull(templates.siteId), eq(templates.siteId, siteId)))
    .orderBy(asc(templates.category), asc(templates.name));
}

export async function getTemplate(templateId: string): Promise<Template | null> {
  await ensureDb();
  const [tpl] = await db.select().from(templates).where(eq(templates.id, templateId)).limit(1);
  return tpl ?? null;
}

export function extractTemplatePlaceholders(
  doc: PageDocument,
): { key: string; label: string; defaultValue: string }[] {
  const raw = JSON.stringify(doc);
  const found = new Set<string>();
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null = regex.exec(raw);
  while (match) {
    found.add(match[1]);
    match = regex.exec(raw);
  }
  return [...found].map((key) => ({
    key,
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    defaultValue: "",
  }));
}

export function applyTemplatePlaceholders(
  doc: PageDocument,
  values: Record<string, string>,
): PageDocument {
  if (Object.keys(values).length === 0) return doc;
  const replaceInValue = (node: unknown): unknown => {
    if (typeof node === "string") {
      return node.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) =>
        values[key] !== undefined && values[key].trim() !== "" ? values[key] : full,
      );
    }
    if (Array.isArray(node)) return node.map(replaceInValue);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, replaceInValue(v)]),
      );
    }
    return node;
  };
  return replaceInValue(doc) as PageDocument;
}

export async function instantiateTemplate(templateId: string): Promise<PageDocument> {
  await ensureDb();
  const [tpl] = await db.select().from(templates).where(eq(templates.id, templateId)).limit(1);
  if (!tpl) throw new NotFoundError("Template not found.");
  return cloneDocumentWithNewIds(migrateDocument(tpl.document));
}

export async function savePageAsTemplate(options: {
  siteId: string;
  pageId: string;
  name: string;
  description: string;
  category: string;
  sharedAcrossSites: boolean;
  actor: Actor;
}): Promise<Template> {
  await ensureDb();
  const page = await getPage(options.siteId, options.pageId);
  if (!page) throw new NotFoundError("Page not found.");

  const [tpl] = await db
    .insert(templates)
    .values({
      siteId: options.sharedAcrossSites ? null : options.siteId,
      name: options.name.trim(),
      description: options.description.trim(),
      category: options.category.trim() || "Saved",
      document: cloneDocumentWithNewIds(migrateDocument(page.draftDocument)),
      createdBy: options.actor.user.id,
    })
    .returning();

  await recordAudit({
    action: "template_created",
    summary: `Saved "${tpl.name}" as a reusable template`,
    siteId: options.siteId,
    actor: options.actor,
    targetType: "template",
    targetId: tpl.id,
  });

  return tpl;
}

export async function deleteTemplate(
  siteId: string,
  templateId: string,
  actor: Actor,
): Promise<void> {
  await ensureDb();
  await db
    .delete(templates)
    .where(
      and(
        eq(templates.id, templateId),
        or(eq(templates.siteId, siteId), isNull(templates.siteId)),
      ),
    );
  await recordAudit({
    action: "template_deleted",
    summary: "Deleted template",
    siteId,
    actor,
    targetType: "template",
    targetId: templateId,
  });
}
