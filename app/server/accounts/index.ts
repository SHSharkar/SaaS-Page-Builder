import "server-only";
import { eq } from "drizzle-orm";
import { slugify } from "@/lib/documents";
import {
  accountMembers,
  accounts,
  pages,
  sites,
  users,
  type AccountRow,
} from "@/app/server/db/schema";
import { withAccount, withPlatform } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";

export async function createWorkspaceAccount(input: {
  name: string;
  ownerUserId: string;
  planKey?: string;
}): Promise<AccountRow> {
  const cleanName = input.name.trim();
  if (cleanName.length < 2) {
    throw new Error("Workspace name must be at least 2 characters");
  }
  const baseSlug = slugify(cleanName);
  const slug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;

  return withPlatform(async (tx) => {
    const [account] = await tx
      .insert(accounts)
      .values({
        name: cleanName,
        slug,
        planKey: input.planKey ?? "starter",
        status: "active",
      })
      .returning();
    if (!account) {
      throw new Error("Failed to create workspace account");
    }
    await tx.insert(accountMembers).values({
      accountId: account.id,
      userId: input.ownerUserId,
      role: "owner",
    });
    await recordAccountAudit(tx, {
      accountId: account.id,
      actorUserId: input.ownerUserId,
      action: "account.created",
      targetType: "account",
      targetId: account.id,
      summary: `Created workspace "${account.name}"`,
    });
    return account;
  });
}

export async function listWorkspaceMembers(accountId: string) {
  return withAccount(accountId, (tx) =>
    tx
      .select({
        memberId: accountMembers.id,
        role: accountMembers.role,
        userId: users.id,
        email: users.email,
        name: users.name,
        createdAt: accountMembers.createdAt,
      })
      .from(accountMembers)
      .innerJoin(users, eq(users.id, accountMembers.userId)),
  );
}

export async function exportAccountSnapshot(accountId: string) {
  return withAccount(accountId, async (tx) => {
    const accountSites = await tx.select().from(sites);
    const accountPages = await tx.select().from(pages);
    return {
      exportedAt: new Date().toISOString(),
      sites: accountSites,
      pages: accountPages,
    };
  });
}
