import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { DEFAULT_SITE_THEME } from "@/lib/documents";
import { deriveDurableScanCode } from "@/app/server/crypto";
import { db } from "./client";
import { accounts, sites } from "./schema";
import { withAccount, withPlatform } from "./with-account";

describe("app/server/db/with-account and forced RLS", () => {
  it("isolates tenant rows strictly per account and blocks bare queries", async () => {
    const slugA = `rls-alpha-${crypto.randomUUID().slice(0, 8)}`;
    const slugB = `rls-beta-${crypto.randomUUID().slice(0, 8)}`;

    const { accountA, accountB } = await withPlatform(async (tx) => {
      const [a] = await tx
        .insert(accounts)
        .values({ name: "Alpha", slug: slugA })
        .returning();
      const [b] = await tx
        .insert(accounts)
        .values({ name: "Beta", slug: slugB })
        .returning();
      if (!a || !b) {
        throw new Error("Failed to seed test accounts");
      }
      return { accountA: a, accountB: b };
    });

    const siteA = await withAccount(accountA.id, async (tx) => {
      const [created] = await tx
        .insert(sites)
        .values({
          accountId: accountA.id,
          name: "Alpha Site",
          slug: slugA,
          scanCode: deriveDurableScanCode(accountA.id, slugA),
          theme: DEFAULT_SITE_THEME,
        })
        .returning();
      return created;
    });
    expect(siteA?.accountId).toBe(accountA.id);

    const visibleToB = await withAccount(accountB.id, (tx) =>
      tx.select().from(sites).where(eq(sites.slug, slugA)),
    );
    expect(visibleToB).toHaveLength(0);

    const visibleToBare = await db
      .select()
      .from(sites)
      .where(eq(sites.slug, slugA));
    expect(visibleToBare).toHaveLength(0);

    const visibleToPlatform = await withPlatform((tx) =>
      tx.select().from(sites).where(eq(sites.slug, slugA)),
    );
    expect(visibleToPlatform).toHaveLength(1);

    await expect(
      withAccount("invalid-uuid", async () => "nope"),
    ).rejects.toThrow("valid account UUID");
  });
});
