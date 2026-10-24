/**
 * Single-use tokens stored in Better Auth's `verification` table.
 *
 * Only the hash is stored, the row carries its own expiry, and consuming one
 * deletes it — so a reset link works exactly once even if it leaks into a log.
 */
import { and, eq, gt, like } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { verifications } from "@/lib/db/schema";
import { hashToken, newToken } from "./password";

export async function verificationToken(identifier: string, minutes = 60) {
  await ensureDb();
  const token = newToken(24);
  const [record] = await db
    .insert(verifications)
    .values({
      identifier,
      value: hashToken(token),
      expiresAt: new Date(Date.now() + minutes * 60_000),
    })
    .returning();
  return { token, record };
}

export async function consumeVerificationToken(prefix: string, token: string): Promise<string | null> {
  await ensureDb();
  if (!token) return null;
  const [row] = await db
    .select()
    .from(verifications)
    .where(
      and(
        like(verifications.identifier, `${prefix}%`),
        eq(verifications.value, hashToken(token)),
        gt(verifications.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db.delete(verifications).where(eq(verifications.id, row.id));
  return row.identifier.slice(prefix.length);
}
