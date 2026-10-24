import { eq } from "drizzle-orm";
import { createWorkspaceAccount } from "../app/server/accounts";
import { hashPassword } from "../app/server/auth/password";
import { closeDbPool } from "../app/server/db/client";
import { authAccounts, sites, users } from "../app/server/db/schema";
import { withPlatform } from "../app/server/db/with-account";
import { listSitePages, publishSitePage } from "../app/server/pages";
import { closeRedisClient } from "../app/server/redis/client";
import { createAccountSite } from "../app/server/sites";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";
import { seedPlatformSettingsAndCatalog } from "./seed-settings";

export const DEMO_ADMIN_EMAIL = "admin@saaspagebuilder.local";
export const DEMO_ADMIN_PASSWORD = "DevSuperPassword!2026";
export const DEMO_SITE_SLUG = "acme-launch";

export async function seedDevelopmentWorkspace(): Promise<void> {
  await seedPlatformSettingsAndCatalog();
  const passwordHash = await hashPassword(DEMO_ADMIN_PASSWORD);

  const adminUser = await withPlatform(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(eq(users.email, DEMO_ADMIN_EMAIL))
      .limit(1);
    if (existing) {
      return existing;
    }
    const [created] = await tx
      .insert(users)
      .values({
        email: DEMO_ADMIN_EMAIL,
        name: "Platform Operator",
        emailVerified: true,
        platformRole: "superadmin",
      })
      .returning();
    if (!created) {
      throw new Error("Failed to seed development operator");
    }
    await tx.insert(authAccounts).values({
      userId: created.id,
      accountId: created.id,
      providerId: "credential",
      password: passwordHash,
    });
    return created;
  });

  const existingDemoSite = await withPlatform(async (tx) => {
    const [found] = await tx
      .select()
      .from(sites)
      .where(eq(sites.slug, DEMO_SITE_SLUG))
      .limit(1);
    return found ?? null;
  });
  if (existingDemoSite) {
    return;
  }

  const account = await createWorkspaceAccount({
    name: "Acme Studio",
    ownerUserId: adminUser.id,
    planKey: "growth",
  });
  const demoSite = await createAccountSite({
    accountId: account.id,
    actorUserId: adminUser.id,
    name: "Acme Launch",
    slug: DEMO_SITE_SLUG,
  });
  const sitePages = await listSitePages(account.id, demoSite.id);
  const homePage = sitePages[0];
  if (homePage) {
    await publishSitePage({
      accountId: account.id,
      actorUserId: adminUser.id,
      siteId: demoSite.id,
      pageId: homePage.id,
      note: "Initial development seed snapshot",
    });
  }
}

if (isMainModule(import.meta.url)) {
  void seedDevelopmentWorkspace()
    .then(async () => {
      await closeDbPool();
      await closeRedisClient();
      log.success(
        "Seeded development workspace, superadmin, and published demo site",
      );
    })
    .catch(async (err: unknown) => {
      await closeDbPool();
      await closeRedisClient();
      log.failed(
        err instanceof Error ? err.message : "Development seed failed",
      );
      process.exit(1);
    });
}
