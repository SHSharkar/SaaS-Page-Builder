import { and, asc, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { templates, type Template } from "@/lib/db/schema";
import {
  collectTokens,
  replaceTokens,
  type PageDocument,
  type PlaceholderSpec,
} from "@/lib/documents";
import { isAdminRank, type Actor } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { createPage } from "@/lib/pages";

export async function listTemplates(options: { includeStaff?: boolean; userId?: string } = {}): Promise<Template[]> {
  await ensureDb();
  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.status, "active"))
    .orderBy(asc(templates.name));
  return rows.filter(
    (template) =>
      template.scope === "platform" ||
      (options.includeStaff && template.scope === "staff" && (!options.userId || template.createdBy === options.userId)),
  );
}

export async function getTemplate(id: string): Promise<Template | null> {
  await ensureDb();
  const [row] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return row ?? null;
}

export function placeholdersFor(template: Template): PlaceholderSpec[] {
  const declared = new Map(template.placeholders.map((placeholder) => [placeholder.key, placeholder]));
  const tokens = collectTokens(template.document);
  const out: PlaceholderSpec[] = [];
  for (const token of tokens) {
    out.push(
      declared.get(token) ?? { key: token, label: token.replace(/[_.-]/g, " "), kind: "text", defaultValue: "" },
    );
  }
  return out;
}

export type ApplyTemplateResult = { pageId: string; slug: string };

export async function applyTemplate(options: {
  siteId: string;
  templateId: string;
  values: Record<string, string>;
  title: string;
  slug: string;
  actor: Actor;
}): Promise<ApplyTemplateResult> {
  await ensureDb();
  const template = await getTemplate(options.templateId);
  if (!template || template.status !== "active") throw new Error("That template is not available.");
  if (template.scope === "staff" && template.createdBy !== options.actor.user.id) {
    throw new Error("That template belongs to another staff member.");
  }

  const tokens: Record<string, string> = {};
  for (const placeholder of placeholdersFor(template)) {
    tokens[placeholder.key] = options.values[placeholder.key] ?? placeholder.defaultValue ?? "";
  }
  const document = replaceTokens(template.document, tokens) as PageDocument;

  const page = await createPage({
    siteId: options.siteId,
    title: options.title || template.name,
    slug: options.slug || template.name,
    document,
    actor: options.actor,
    source: "template",
    seo: { description: template.description || undefined, canonicalMode: "self", noindex: false },
  });

  await recordAudit({
    action: "template_applied",
    summary: `Created “${page.title}” from the template “${template.name}”`,
    siteId: options.siteId,
    actor: options.actor,
    targetType: "page",
    targetId: page.id,
    detail: { templateId: template.id, placeholders: Object.keys(tokens) },
  });

  return { pageId: page.id, slug: page.slug };
}

export async function savePageAsTemplate(options: {
  siteId: string;
  document: PageDocument;
  name: string;
  description: string;
  actor: Actor;
}): Promise<Template> {
  await ensureDb();
  const tokens = [...collectTokens(options.document)].map<PlaceholderSpec>((token) => ({
    key: token,
    label: token.replace(/[_.-]/g, " "),
    kind: "text",
    defaultValue: "",
  }));
  const [template] = await db
    .insert(templates)
    .values({
      scope: "staff",
      name: options.name,
      description: options.description,
      document: options.document,
      placeholders: tokens,
      status: "active",
      createdBy: options.actor.user.id,
    })
    .returning();
  await recordAudit({
    action: "template_created",
    summary: `Saved “${template.name}” as a staff template`,
    siteId: options.siteId,
    actor: options.actor,
    targetType: "template",
    targetId: template.id,
  });
  return template;
}

export async function retireTemplate(id: string, actor: Actor): Promise<void> {
  await ensureDb();
  const template = await getTemplate(id);
  if (!template) throw new Error("Template not found.");
  if (template.scope === "staff" && template.createdBy !== actor.user.id && !isAdminRank(actor)) {
    throw new Error("Only the author or an admin can retire a staff template.");
  }
  await db.update(templates).set({ status: "retired", updatedAt: new Date() }).where(and(eq(templates.id, id)));
}
