/**
 * Object storage. Two backends, one contract:
 *
 * - `r2` — Cloudflare R2 with presigned PUTs (production, ADR-004).
 * - `local` — the filesystem under MEDIA_DIR (this build and the CI smoke run).
 *
 * Bytes are always re-read and re-verified after upload before a row becomes
 * `ready`, whichever backend stored them.
 */
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export type StorageBackend = "local" | "r2";

export const MEDIA_DIR = process.env.MEDIA_DIR ?? path.join(process.cwd(), "data", "media");

const R2 = {
  accountId: process.env.R2_ACCOUNT_ID ?? "",
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  bucket: process.env.R2_BUCKET ?? "",
  publicBase: process.env.R2_PUBLIC_BASE_URL ?? "",
};

export function storageBackend(): StorageBackend {
  return R2.accountId && R2.accessKeyId && R2.secretAccessKey && R2.bucket ? "r2" : "local";
}

/** In R2 mode bytes are fetched from the public base; locally they are a route. */
export function publicUrlFor(key: string): string {
  if (storageBackend() === "r2" && R2.publicBase) {
    return `${R2.publicBase.replace(/\/$/, "")}/${key}`;
  }
  return `/media/${path.basename(key)}`;
}

async function r2() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2.accessKeyId, secretAccessKey: R2.secretAccessKey },
  });
}

export async function putObject(key: string, bytes: Buffer, contentType: string): Promise<void> {
  if (storageBackend() === "local") {
    const destination = path.join(MEDIA_DIR, key);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes);
    return;
  }
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await r2();
  await client.send(
    new PutObjectCommand({ Bucket: R2.bucket, Key: key, Body: bytes, ContentType: contentType }),
  );
}

export async function getObject(key: string): Promise<Buffer | null> {
  if (storageBackend() === "local") {
    try {
      return await readFile(path.join(MEDIA_DIR, key));
    } catch {
      return null;
    }
  }
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await r2();
  try {
    const response = await client.send(new GetObjectCommand({ Bucket: R2.bucket, Key: key }));
    const body = response.Body as { transformToByteArray?: () => Promise<Uint8Array> } | undefined;
    if (!body?.transformToByteArray) return null;
    return Buffer.from(await body.transformToByteArray());
  } catch {
    return null;
  }
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  if (storageBackend() === "local") {
    try {
      const info = await stat(path.join(MEDIA_DIR, key));
      return { size: info.size };
    } catch {
      return null;
    }
  }
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await r2();
  try {
    const response = await client.send(new HeadObjectCommand({ Bucket: R2.bucket, Key: key }));
    return { size: response.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  if (storageBackend() === "local") {
    try {
      await unlink(path.join(MEDIA_DIR, key));
    } catch {
      /* missing file is already the desired state */
    }
    return;
  }
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await r2();
  await client.send(new DeleteObjectCommand({ Bucket: R2.bucket, Key: key }));
}

/**
 * A direct browser → R2 upload link. The local backend has no such thing, so it
 * returns null and the caller falls back to posting the bytes to our own route.
 */
export async function presignPut(
  key: string,
  contentType: string,
  expiresInSeconds = 600,
): Promise<{ url: string; headers: Record<string, string> } | null> {
  if (storageBackend() === "local") return null;
  const { PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const client = await r2();
  const command = new PutObjectCommand({ Bucket: R2.bucket, Key: key, ContentType: contentType });
  const url = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
  return { url, headers: { "Content-Type": contentType } };
}

export const storageInfo = () => ({
  backend: storageBackend(),
  bucket: storageBackend() === "r2" ? R2.bucket : null,
  publicBase: storageBackend() === "r2" ? R2.publicBase || "(not set)" : "/media",
  mediaDir: storageBackend() === "local" ? MEDIA_DIR : null,
});
