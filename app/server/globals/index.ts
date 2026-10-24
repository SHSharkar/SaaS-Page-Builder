import "server-only";
import { and, eq } from "drizzle-orm";
import type { PageDocument } from "@/lib/documents";
import type { GlobalKind } from "@/lib/enums";
import { validateDocument } from "@/lib/registry";
import { siteContents, type SiteContentRow } from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";

export async function listSiteGlobals(
  accountId: string,
  siteId: string,
): Promise<SiteContentRow[]> {
  return withAccount(accountId, (tx) =>
    tx.select().from(siteContents).where(eq(siteContents.siteId, siteId)),
  );
}

export async function publishSiteGlobal(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  kind: GlobalKind;
  document: PageDocument;
}): Promise<SiteContentRow> {
  const check = validateDocument(input.document);
  if (!check.valid) {
    throw new Error(check.errors.join("; "));
  }
  return withAccount(input.accountId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(siteContents)
      .where(
        and(
          eq(siteContents.siteId, input.siteId),
          eq(siteContents.kind, input.kind),
        ),
      )
      .limit(1);
    if (!existing) {
      throw new Error("Site global slot not found");
    }
    const [updated] = await tx
      .update(siteContents)
      .set({
        draftDocument: input.document,
        publishedDocument: input.document,
        publishedAt: new Date(),
        updatedBy: input.actorUserId,
        lockVersion: existing.lockVersion + 1,
        updatedAt: new Date(),
      })
      .where(eq(siteContents.id, existing.id))
      .returning();
    if (!updated) {
      throw new Error("Failed to publish site global");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "globals.published",
      targetType: "site_content",
      targetId: updated.id,
      summary: `Published ${input.kind} global for site`,
    });
    return updated;
  });
}
