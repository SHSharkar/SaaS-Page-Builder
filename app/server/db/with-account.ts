import "server-only";
import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { isUuid } from "@/lib/identifiers";
import { getDb } from "./client";
import type * as schema from "./schema";

export type ScopedTx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

export const SERIALIZATION_RETRY_LIMIT = 3;

function isRetryableSerializationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "40001" || code === "40P01";
}

async function runWithRetries<T>(work: () => Promise<T>): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await work();
    } catch (error) {
      attempt += 1;
      if (
        !isRetryableSerializationError(error) ||
        attempt > SERIALIZATION_RETRY_LIMIT
      ) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt));
    }
  }
}

export async function withAccount<T>(
  accountId: string,
  fn: (tx: ScopedTx) => Promise<T>,
): Promise<T> {
  if (!isUuid(accountId)) {
    throw new Error("withAccount requires a valid account UUID");
  }
  return runWithRetries(() =>
    getDb().transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.platform_bypass', 'off', true), set_config('app.account_id', ${accountId}, true)`,
      );
      return fn(tx);
    }),
  );
}

export async function withPlatform<T>(
  fn: (tx: ScopedTx) => Promise<T>,
): Promise<T> {
  return runWithRetries(() =>
    getDb().transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.platform_bypass', 'on', true), set_config('app.account_id', '', true)`,
      );
      return fn(tx);
    }),
  );
}
