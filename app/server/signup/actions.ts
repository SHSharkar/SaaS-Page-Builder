"use server";

import { requirePublicActionRateLimit } from "@/app/server/auth/guards";
import { hashPassword } from "@/app/server/auth/password";
import { createWorkspaceAccount } from "@/app/server/accounts";
import { authAccounts, users } from "@/app/server/db/schema";
import { withPlatform } from "@/app/server/db/with-account";

export async function signUpWorkspaceAction(input: {
  name: string;
  email: string;
  password: string;
  workspaceName: string;
  clientKey: string;
}): Promise<{ ok: boolean; accountId: string; userId: string }> {
  await requirePublicActionRateLimit("signup", input.clientKey, 10, 300);
  const cleanEmail = input.email.trim().toLowerCase();
  if (!cleanEmail.includes("@")) {
    throw new Error("Enter a valid email address");
  }
  const passwordHash = await hashPassword(input.password);

  const user = await withPlatform(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        email: cleanEmail,
        name: input.name.trim() || "Workspace Owner",
        emailVerified: false,
        platformRole: "none",
      })
      .returning();
    if (!createdUser) {
      throw new Error("Failed to create user");
    }
    await tx.insert(authAccounts).values({
      userId: createdUser.id,
      accountId: createdUser.id,
      providerId: "credential",
      password: passwordHash,
    });
    return createdUser;
  });

  const account = await createWorkspaceAccount({
    name: input.workspaceName,
    ownerUserId: user.id,
  });

  return { ok: true, accountId: account.id, userId: user.id };
}
