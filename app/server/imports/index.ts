import "server-only";
import * as cheerio from "cheerio";
import { desc, eq } from "drizzle-orm";
import {
  emptyDocument,
  type ImportReport,
  type ImportReviewDecision,
  type ImportSegment,
  type PageDocument,
} from "@/lib/documents";
import { importJobs, type ImportJobRow } from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";
import { createSitePage } from "@/app/server/pages";

export const MAX_IMPORT_HTML_BYTES = 5 * 1024 * 1024;

export function analyzeHtmlDocument(rawHtml: string): ImportReport {
  const byteSize = new TextEncoder().encode(rawHtml).byteLength;
  if (byteSize > MAX_IMPORT_HTML_BYTES) {
    throw new Error("HTML input exceeds 5 MB import limit");
  }
  const $ = cheerio.load(rawHtml);
  $("script, style, noscript, iframe").remove();

  const title = $("title").first().text().trim() || "Imported Page";
  const description =
    $('meta[name="description"]').attr("content")?.trim() ?? "";

  const segments: ImportSegment[] = [];
  $("header, main > section, section, article, footer").each((idx, el) => {
    const tagName = el.tagName.toLowerCase();
    const heading =
      $(el).find("h1, h2, h3").first().text().trim() || `Section ${idx + 1}`;
    const textPreview = $(el).text().replace(/\s+/g, " ").trim().slice(0, 240);
    if (!textPreview) {
      return;
    }
    const suggestedBlockType =
      tagName === "header"
        ? "site-header"
        : tagName === "footer"
          ? "site-footer"
          : idx === 0
            ? "hero-banner"
            : "rich-text";
    const proposedProps =
      suggestedBlockType === "hero-banner"
        ? { headline: heading, subheadline: textPreview }
        : suggestedBlockType === "site-header"
          ? { brandLabel: heading }
          : suggestedBlockType === "site-footer"
            ? { copyright: textPreview.slice(0, 120) }
            : { heading, body: textPreview };

    segments.push({
      id: `seg_${idx + 1}`,
      tagName,
      heading,
      textPreview,
      suggestedBlockType,
      rawHtml: $.html(el).slice(0, 4_000),
      proposedProps,
    });
  });

  return {
    title,
    description,
    segmentCount: segments.length,
    warnings: segments.length === 0 ? ["No semantic sections detected"] : [],
    segments,
  };
}

export async function listSiteImports(
  accountId: string,
  siteId?: string,
): Promise<ImportJobRow[]> {
  return withAccount(accountId, (tx) =>
    siteId
      ? tx
          .select()
          .from(importJobs)
          .where(eq(importJobs.siteId, siteId))
          .orderBy(desc(importJobs.createdAt))
      : tx.select().from(importJobs).orderBy(desc(importJobs.createdAt)),
  );
}

export async function submitHtmlImport(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  sourceFilename: string;
  rawHtml: string;
}): Promise<ImportJobRow> {
  const report = analyzeHtmlDocument(input.rawHtml);
  const byteSize = new TextEncoder().encode(input.rawHtml).byteLength;

  return withAccount(input.accountId, async (tx) => {
    const [job] = await tx
      .insert(importJobs)
      .values({
        accountId: input.accountId,
        siteId: input.siteId,
        status: "in_review",
        sourceFilename: input.sourceFilename,
        sourceSizeBytes: byteSize,
        report,
        createdBy: input.actorUserId,
      })
      .returning();
    if (!job) {
      throw new Error("Failed to create import job");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "import.submitted",
      targetType: "import_job",
      targetId: job.id,
      summary: `Submitted HTML import "${input.sourceFilename}"`,
    });
    return job;
  });
}

export async function applyReviewedImport(input: {
  accountId: string;
  actorUserId: string;
  jobId: string;
  slug: string;
  decisions: ImportReviewDecision[];
}): Promise<{ job: ImportJobRow; pageId: string }> {
  const job = await withAccount(input.accountId, async (tx) => {
    const [found] = await tx
      .select()
      .from(importJobs)
      .where(eq(importJobs.id, input.jobId))
      .limit(1);
    if (!found || !found.report) {
      throw new Error("Import job not found");
    }
    const [updated] = await tx
      .update(importJobs)
      .set({
        status: "applied",
        reviewDecisions: input.decisions,
        appliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importJobs.id, input.jobId))
      .returning();
    if (!updated) {
      throw new Error("Failed to mark import applied");
    }
    return updated;
  });

  const doc: PageDocument = emptyDocument(job.report?.title ?? "Imported");
  const decisionBySegment = new Map(
    input.decisions.map((d) => [d.segmentId, d]),
  );
  for (const seg of job.report?.segments ?? []) {
    const dec = decisionBySegment.get(seg.id);
    if (dec?.action === "skip") {
      continue;
    }
    doc.content.push({
      id: `blk_${seg.id}`,
      type: dec?.blockType ?? seg.suggestedBlockType,
      props: seg.proposedProps,
    });
  }

  const page = await createSitePage({
    accountId: input.accountId,
    actorUserId: input.actorUserId,
    siteId: job.siteId,
    title: job.report?.title ?? "Imported Page",
    slug: input.slug,
    document: doc,
  });

  return { job, pageId: page.id };
}
