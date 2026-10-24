import "server-only";
import { asc, eq } from "drizzle-orm";
import {
  cloneDocumentWithNewIds,
  slugify,
  type PageDocument,
} from "@/lib/documents";
import { db } from "@/app/server/db/client";
import {
  accountTemplates,
  platformTemplates,
  type AccountTemplateRow,
  type PlatformTemplateRow,
} from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";

export async function listPlatformTemplates(): Promise<PlatformTemplateRow[]> {
  return db
    .select()
    .from(platformTemplates)
    .where(eq(platformTemplates.status, "active"))
    .orderBy(asc(platformTemplates.name));
}

export async function listAccountTemplates(
  accountId: string,
): Promise<AccountTemplateRow[]> {
  return withAccount(accountId, (tx) =>
    tx
      .select()
      .from(accountTemplates)
      .where(eq(accountTemplates.status, "active"))
      .orderBy(asc(accountTemplates.name)),
  );
}

export async function createAccountTemplate(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  name: string;
  category?: string;
  document: PageDocument;
}): Promise<AccountTemplateRow> {
  const cleanName = input.name.trim();
  if (cleanName.length < 2) {
    throw new Error("Template name must be at least 2 characters");
  }
  const cloned = cloneDocumentWithNewIds(input.document);

  return withAccount(input.accountId, async (tx) => {
    const [created] = await tx
      .insert(accountTemplates)
      .values({
        accountId: input.accountId,
        siteId: input.siteId,
        slug: `${slugify(cleanName)}-${crypto.randomUUID().slice(0, 6)}`,
        name: cleanName,
        category: input.category ?? "landing",
        status: "active",
        scope: "account",
        createdBy: input.actorUserId,
        document: cloned,
      })
      .returning();
    if (!created) {
      throw new Error("Failed to save workspace template");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "template.created",
      targetType: "account_template",
      targetId: created.id,
      summary: `Saved workspace template "${created.name}"`,
    });
    return created;
  });
}
