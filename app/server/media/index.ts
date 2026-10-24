import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import sharp from "sharp";
import {
  mediaAssets,
  mediaReferences,
  type MediaAssetRow,
} from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { recordAccountAudit } from "@/app/server/audit";
import { createPresignedUploadUrl } from "@/app/server/storage/r2";

export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

function matchesBytes(
  bytes: Uint8Array,
  offset: number,
  expected: readonly number[],
): boolean {
  if (bytes.length < offset + expected.length) {
    return false;
  }
  return expected.every((val, idx) => bytes[offset + idx] === val);
}

export function sniffImageMimeType(bytes: Uint8Array): string | null {
  if (matchesBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47])) {
    return "image/png";
  }
  if (matchesBytes(bytes, 0, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }
  if (
    matchesBytes(bytes, 0, [0x52, 0x49, 0x46, 0x46]) &&
    matchesBytes(bytes, 8, [0x57, 0x45])
  ) {
    return "image/webp";
  }
  return null;
}

export function checksumBytes(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function inspectImageDimensions(
  bytes: Buffer,
): Promise<{ width: number; height: number; format: string }> {
  const meta = await sharp(bytes).metadata();
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    format: meta.format ?? "unknown",
  };
}

export async function listSiteMedia(
  accountId: string,
  siteId?: string,
): Promise<MediaAssetRow[]> {
  return withAccount(accountId, (tx) =>
    tx
      .select()
      .from(mediaAssets)
      .where(
        siteId
          ? and(eq(mediaAssets.siteId, siteId), isNull(mediaAssets.deletedAt))
          : isNull(mediaAssets.deletedAt),
      )
      .orderBy(desc(mediaAssets.createdAt)),
  );
}

export async function registerSiteMediaAsset(input: {
  accountId: string;
  actorUserId: string;
  siteId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  altText?: string;
}): Promise<{ asset: MediaAssetRow; uploadUrl: string }> {
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_MEDIA_BYTES) {
    throw new Error("Media file must be between 1 byte and 10 MB");
  }
  const safeName = input.originalName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .slice(0, 80);
  const storageKey = `${input.accountId}/${input.siteId}/${crypto.randomUUID()}-${safeName || "asset"}`;
  const { uploadUrl, publicUrl } = await createPresignedUploadUrl({
    storageKey,
    contentType: input.mimeType,
  });

  const asset = await withAccount(input.accountId, async (tx) => {
    const [existing] = await tx
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.siteId, input.siteId),
          eq(mediaAssets.checksum, input.checksum),
          isNull(mediaAssets.deletedAt),
        ),
      )
      .limit(1);
    if (existing) {
      return existing;
    }

    const [created] = await tx
      .insert(mediaAssets)
      .values({
        accountId: input.accountId,
        siteId: input.siteId,
        kind: "image",
        status: "ready",
        filename: safeName || "asset",
        originalName: input.originalName,
        storageKey,
        publicUrl,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        checksum: input.checksum,
        altText: input.altText ?? "",
        uploadedBy: input.actorUserId,
        confirmedAt: new Date(),
      })
      .returning();
    if (!created) {
      throw new Error("Failed to register media asset");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "media.registered",
      targetType: "media_asset",
      targetId: created.id,
      summary: `Registered media "${created.originalName}"`,
    });
    return created;
  });

  return { asset, uploadUrl };
}

export async function retireMediaAsset(input: {
  accountId: string;
  actorUserId: string;
  mediaId: string;
}): Promise<MediaAssetRow> {
  return withAccount(input.accountId, async (tx) => {
    const refs = await tx
      .select({ id: mediaReferences.id })
      .from(mediaReferences)
      .where(eq(mediaReferences.mediaId, input.mediaId))
      .limit(1);
    if (refs.length > 0) {
      throw new Error("Cannot retire media asset while referenced by a page");
    }
    const [retired] = await tx
      .update(mediaAssets)
      .set({ status: "deleted", deletedAt: new Date() })
      .where(eq(mediaAssets.id, input.mediaId))
      .returning();
    if (!retired) {
      throw new Error("Media asset not found");
    }
    await recordAccountAudit(tx, {
      accountId: input.accountId,
      actorUserId: input.actorUserId,
      action: "media.retired",
      targetType: "media_asset",
      targetId: retired.id,
      summary: `Retired media "${retired.originalName}"`,
    });
    return retired;
  });
}
