import "server-only";
import type { AccountRole, PlatformRole } from "@/lib/enums";
import { createWorkspaceAccount } from "@/app/server/accounts";
import { setTestSessionContext } from "@/app/server/auth/session";
import { authSessions, users } from "@/app/server/db/schema";
import { withPlatform } from "@/app/server/db/with-account";

export async function createTestWorkspaceFixture(options?: {
  accountRole?: AccountRole;
  platformRole?: PlatformRole;
}) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const user = await withPlatform(async (tx) => {
    const [created] = await tx
      .insert(users)
      .values({
        email: `actor-${suffix}@example.test`,
        name: `Actor ${suffix}`,
        emailVerified: true,
        platformRole: options?.platformRole ?? "none",
      })
      .returning();
    if (!created) {
      throw new Error("Failed to seed test user");
    }
    return created;
  });

  const account = await createWorkspaceAccount({
    name: `Workspace ${suffix}`,
    ownerUserId: user.id,
  });

  const session = await withPlatform(async (tx) => {
    const [sess] = await tx
      .insert(authSessions)
      .values({
        userId: user.id,
        activeAccountId: account.id,
        token: `tok_${crypto.randomUUID()}`,
        expiresAt: new Date(Date.now() + 3_600_000),
      })
      .returning();
    if (!sess) {
      throw new Error("Failed to seed test session");
    }
    return sess;
  });

  const context = {
    user,
    session,
    account,
    accountRole: options?.accountRole ?? "owner",
    platformRole: options?.platformRole ?? "none",
  } as const;

  setTestSessionContext(context);
  return context;
}
