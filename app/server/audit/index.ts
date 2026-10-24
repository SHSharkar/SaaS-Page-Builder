import "server-only";
import { accountAuditLogs, platformAuditLogs } from "@/app/server/db/schema";
import type { ScopedTx } from "@/app/server/db/with-account";

export interface AccountAuditInput {
  readonly accountId: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly summary: string;
  readonly detail?: Record<string, unknown> | null;
}

export async function recordAccountAudit(
  tx: ScopedTx,
  input: AccountAuditInput,
): Promise<void> {
  await tx.insert(accountAuditLogs).values({
    accountId: input.accountId,
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    detail: input.detail ?? null,
  });
}

export async function recordPlatformAudit(
  tx: ScopedTx,
  input: Omit<AccountAuditInput, "accountId">,
): Promise<void> {
  await tx.insert(platformAuditLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    summary: input.summary,
    detail: input.detail ?? null,
  });
}
