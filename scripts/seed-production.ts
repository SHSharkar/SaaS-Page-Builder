import { eq } from "drizzle-orm";
import { hashPassword } from "../app/server/auth/password";
import { closeDbPool } from "../app/server/db/client";
import { authAccounts, users } from "../app/server/db/schema";
import { withPlatform } from "../app/server/db/with-account";
import { getEnv } from "../app/server/env";
import { isMainModule } from "./lib/check";
import { log } from "./lib/log";
import { seedPlatformSettingsAndCatalog } from "./seed-settings";

export async function seedProductionBootstrap(): Promise<void> {
  await seedPlatformSettingsAndCatalog();
  const env = getEnv();
  if (!env.BOOTSTRAP_ADMIN_EMAIL || !env.BOOTSTRAP_ADMIN_PASSWORD) {
    return;
  }

  const email = env.BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await hashPassword(env.BOOTSTRAP_ADMIN_PASSWORD);

  await withPlatform(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) {
      return;
    }
    const [created] = await tx
      .insert(users)
      .values({
        email,
        name: env.BOOTSTRAP_ADMIN_NAME ?? "Platform Superadmin",
        emailVerified: true,
        platformRole: "superadmin",
      })
      .returning();
    if (created) {
      await tx.insert(authAccounts).values({
        userId: created.id,
        accountId: created.id,
        providerId: "credential",
        password: passwordHash,
      });
    }
  });
}

if (isMainModule(import.meta.url)) {
  void seedProductionBootstrap()
    .then(async () => {
      await closeDbPool();
      log.success("Completed idempotent production bootstrap seed");
    })
    .catch(async (err: unknown) => {
      await closeDbPool();
      log.failed(err instanceof Error ? err.message : "Production seed failed");
      process.exit(1);
    });
}
