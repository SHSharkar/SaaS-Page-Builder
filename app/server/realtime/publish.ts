import "server-only";
import { getDbPool } from "@/app/server/db/client";
import { isUuid } from "@/lib/identifiers";

export const ACCOUNT_CHANGED_CHANNEL = "account_changed";

export interface AccountChangedPayload {
  readonly accountId: string;
  readonly topic: string;
  readonly ids: readonly string[];
}

export function serializeRealtimePayload(
  payload: AccountChangedPayload,
): string {
  if (!isUuid(payload.accountId)) {
    throw new Error("Realtime event requires a valid account UUID");
  }
  if (!/^[a-z0-9._-]+$/.test(payload.topic)) {
    throw new Error("Realtime topic must contain only safe ASCII tokens");
  }
  for (const id of payload.ids) {
    if (!isUuid(id) && !/^[a-z0-9_-]{1,64}$/i.test(id)) {
      throw new Error("Realtime payload can carry opaque identifiers only");
    }
  }
  return JSON.stringify({
    accountId: payload.accountId,
    topic: payload.topic,
    ids: payload.ids,
  });
}

export async function publishAccountChange(
  accountId: string,
  topic: string,
  ids: readonly string[] = [],
): Promise<void> {
  const serialized = serializeRealtimePayload({ accountId, topic, ids });
  await getDbPool().query("SELECT pg_notify($1, $2)", [
    ACCOUNT_CHANGED_CHANNEL,
    serialized,
  ]);
}
