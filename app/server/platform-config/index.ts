import "server-only";
import { eq } from "drizzle-orm";
import { decryptField, encryptField } from "@/app/server/crypto";
import { db } from "@/app/server/db/client";
import { platformSettings } from "@/app/server/db/schema";

export async function setPlatformSetting(input: {
  key: string;
  value: string | number | boolean;
  isSecret?: boolean;
  description?: string;
  actorUserId?: string | null;
}): Promise<void> {
  const isSecret = Boolean(input.isSecret);
  const encryptedValue = isSecret ? encryptField(String(input.value)) : null;
  const jsonValue = isSecret ? null : input.value;

  await db
    .insert(platformSettings)
    .values({
      key: input.key,
      value: jsonValue,
      encryptedValue,
      isSecret,
      description: input.description ?? "",
      updatedBy: input.actorUserId ?? null,
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        value: jsonValue,
        encryptedValue,
        isSecret,
        description: input.description ?? "",
        updatedBy: input.actorUserId ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function getPlatformSettingString(
  key: string,
): Promise<string | null> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  if (!row) {
    return null;
  }
  if (row.isSecret && row.encryptedValue) {
    return decryptField(row.encryptedValue);
  }
  return row.value !== null && row.value !== undefined
    ? String(row.value)
    : null;
}
