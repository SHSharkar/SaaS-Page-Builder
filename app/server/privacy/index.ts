import "server-only";
import { desc, eq } from "drizzle-orm";
import { publicSubscriberLabel } from "@/lib/identifiers";
import {
  computeLookupHash,
  decryptContact,
  encryptContact,
} from "@/app/server/crypto";
import { getDbPool } from "@/app/server/db/client";
import { erasureLogs, guestContacts } from "@/app/server/db/schema";
import { withAccount, withPlatform } from "@/app/server/db/with-account";
import { consumeSlidingBudget } from "@/app/server/redis/client";

export interface AnonymousContactView {
  readonly id: string;
  readonly publicId: string;
  readonly customerNumber: number;
  readonly displayLabel: string;
  readonly createdAt: Date;
}

export async function sealGuestContact(input: {
  accountId: string;
  siteId: string;
  rawContact: string;
}): Promise<AnonymousContactView> {
  const trimmed = input.rawContact.trim();
  if (trimmed.length < 3) {
    throw new Error("Contact value is too short");
  }
  const lookupHash = computeLookupHash("guest-contact", trimmed);
  const contactCiphertext = encryptContact(trimmed);
  const publicId = `gst_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;

  return withAccount(input.accountId, async (tx) => {
    const existing = await tx
      .select({ num: guestContacts.customerNumber })
      .from(guestContacts)
      .where(eq(guestContacts.siteId, input.siteId))
      .orderBy(desc(guestContacts.customerNumber))
      .limit(1);
    const nextNumber = (existing[0]?.num ?? 0) + 1;

    const [created] = await tx
      .insert(guestContacts)
      .values({
        accountId: input.accountId,
        siteId: input.siteId,
        publicId,
        customerNumber: nextNumber,
        lookupHash,
        contactCiphertext,
      })
      .returning({
        id: guestContacts.id,
        publicId: guestContacts.publicId,
        customerNumber: guestContacts.customerNumber,
        createdAt: guestContacts.createdAt,
      });
    if (!created) {
      throw new Error("Failed to seal guest contact");
    }
    return {
      ...created,
      displayLabel: publicSubscriberLabel(
        created.publicId,
        created.customerNumber,
      ),
    };
  });
}

export async function listAnonymousContacts(
  accountId: string,
): Promise<AnonymousContactView[]> {
  const rows = await withAccount(accountId, (tx) =>
    tx
      .select({
        id: guestContacts.id,
        publicId: guestContacts.publicId,
        customerNumber: guestContacts.customerNumber,
        createdAt: guestContacts.createdAt,
      })
      .from(guestContacts)
      .orderBy(desc(guestContacts.createdAt)),
  );
  return rows.map((row) => ({
    ...row,
    displayLabel: publicSubscriberLabel(row.publicId, row.customerNumber),
  }));
}

export async function eraseGuestByRawContact(
  rawContact: string,
  reason = "user_erasure_request",
): Promise<{ erasedCount: number }> {
  const lookupHash = computeLookupHash("guest-contact", rawContact);
  return withPlatform(async (tx) => {
    const deleted = await tx
      .delete(guestContacts)
      .where(eq(guestContacts.lookupHash, lookupHash))
      .returning({ id: guestContacts.id });
    await tx.insert(erasureLogs).values({
      subjectLookupHash: lookupHash,
      reason,
    });
    return { erasedCount: deleted.length };
  });
}

export async function superadminRevealGuestContact(input: {
  contactId: string;
  actorUserId: string;
  reason: string;
}): Promise<string> {
  const budget = await consumeSlidingBudget(
    `reveal:${input.actorUserId}`,
    5,
    3_600,
  );
  if (!budget.allowed) {
    throw new Error("Superadmin reveal rate limit exceeded");
  }
  const res = await getDbPool().query<{ cipher: string }>(
    "SELECT superadmin_reveal_contact($1, $2, $3) AS cipher",
    [input.contactId, input.actorUserId, input.reason],
  );
  const cipher = res.rows[0]?.cipher;
  if (!cipher) {
    throw new Error("Failed to reveal contact");
  }
  return decryptContact(cipher);
}
