import "server-only";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import type { AccountRole, PlatformRole } from "@/lib/enums";
import { db } from "@/app/server/db/client";
import {
  accountMembers,
  accounts,
  authSessions,
  users,
  type AccountRow,
  type AuthSessionRow,
  type UserRow,
} from "@/app/server/db/schema";
import { withPlatform } from "@/app/server/db/with-account";
import { auth } from "./server";

export interface SessionContext {
  readonly user: UserRow;
  readonly session: AuthSessionRow;
  readonly account: AccountRow | null;
  readonly accountRole: AccountRole | null;
  readonly platformRole: PlatformRole;
}

const globalTestActor = globalThis as unknown as {
  __spbTestSessionContext?: SessionContext | null;
};

export function setTestSessionContext(
  context: SessionContext | null | undefined,
): void {
  if (context === undefined) {
    delete globalTestActor.__spbTestSessionContext;
    return;
  }
  globalTestActor.__spbTestSessionContext = context;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  if (globalTestActor.__spbTestSessionContext !== undefined) {
    return globalTestActor.__spbTestSessionContext;
  }
  const reqHeaders = await headers();
  const resolved = await auth.api
    .getSession({ headers: reqHeaders })
    .catch(() => null);
  if (!resolved) {
    return null;
  }

  const [userRow] = await db
    .select()
    .from(users)
    .where(eq(users.id, resolved.user.id))
    .limit(1);
  if (!userRow || userRow.banned) {
    return null;
  }

  const [sessionRow] = await db
    .select()
    .from(authSessions)
    .where(eq(authSessions.id, resolved.session.id))
    .limit(1);
  if (!sessionRow) {
    return null;
  }

  const membership = await withPlatform(async (tx) => {
    const rows = await tx
      .select({
        member: accountMembers,
        account: accounts,
      })
      .from(accountMembers)
      .innerJoin(accounts, eq(accounts.id, accountMembers.accountId))
      .where(eq(accountMembers.userId, userRow.id));
    if (rows.length === 0) {
      return null;
    }
    const preferred = sessionRow.activeAccountId
      ? rows.find((r) => r.account.id === sessionRow.activeAccountId)
      : undefined;
    return preferred ?? rows[0] ?? null;
  });

  return {
    user: userRow,
    session: sessionRow,
    account: membership?.account ?? null,
    accountRole: membership?.member.role ?? null,
    platformRole: userRow.platformRole,
  };
}
