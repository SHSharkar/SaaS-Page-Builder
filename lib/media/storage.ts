import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type StorageBackend = "s3" | "local";

function localDir(): string {
  return (
    process.env.MEDIA_DIR?.trim() ||
    process.env.MEDIA_STORAGE_DIR?.trim() ||
    path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "media")
  );
}

function s3Config() {
  const bucket = (process.env.S3_BUCKET ?? process.env.R2_BUCKET)?.trim();
  if (!bucket) return null;
  const r2AccountId = process.env.R2_ACCOUNT_ID?.trim();
  const endpoint =
    process.env.S3_ENDPOINT?.trim() ||
    (r2AccountId ? `https://${r2AccountId}.r2.cloudflarestorage.com` : undefined);
  const region = process.env.S3_REGION?.trim() || "auto";
  const accessKeyId = (process.env.S3_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID)?.trim();
  const secretAccessKey = (
    process.env.S3_SECRET_ACCESS_KEY ?? process.env.R2_SECRET_ACCESS_KEY
  )?.trim();
  const publicBase =
    (process.env.S3_PUBLIC_BASE_URL ?? process.env.R2_PUBLIC_BASE_URL)
      ?.trim()
      ?.replace(/\/+$/, "") || null;
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true" || Boolean(endpoint);
  return { bucket, endpoint, region, accessKeyId, secretAccessKey, publicBase, forcePathStyle };
}

let cachedClient: S3Client | null = null;
function client(): { s3: S3Client; bucket: string; publicBase: string | null } | null {
  const cfg = s3Config();
  if (!cfg) return null;
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials:
        cfg.accessKeyId && cfg.secretAccessKey
          ? { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
          : undefined,
    });
  }
  return { s3: cachedClient, bucket: cfg.bucket, publicBase: cfg.publicBase };
}

export function storageBackend(): StorageBackend {
  return s3Config() ? "s3" : "local";
}

function localPath(key: string): string {
  const normalized = path.posix.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
  return path.join(/*turbopackIgnore: true*/ localDir(), normalized);
}

export async function putObject(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ publicUrl: string }> {
  const c = client();
  if (c) {
    await c.s3.send(
      new PutObjectCommand({
        Bucket: c.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return { publicUrl: publicUrlFor(key) };
  }
  const dest = localPath(key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, bytes);
  return { publicUrl: publicUrlFor(key) };
}

export async function getObject(key: string): Promise<Buffer | null> {
  const c = client();
  if (c) {
    try {
      const out = await c.s3.send(new GetObjectCommand({ Bucket: c.bucket, Key: key }));
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      return Buffer.from(bytes);
    } catch {
      return null;
    }
  }
  try {
    return await fs.readFile(/*turbopackIgnore: true*/ localPath(key));
  } catch {
    return null;
  }
}

export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  const c = client();
  if (c) {
    try {
      const out = await c.s3.send(new HeadObjectCommand({ Bucket: c.bucket, Key: key }));
      return { size: Number(out.ContentLength ?? 0), contentType: out.ContentType ?? null };
    } catch {
      return null;
    }
  }
  try {
    const stat = await fs.stat(/*turbopackIgnore: true*/ localPath(key));
    return { size: stat.size, contentType: null };
  } catch {
    return null;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const c = client();
  if (c) {
    try {
      await c.s3.send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
    } catch {
      // Missing objects are safe to ignore.
    }
    return;
  }
  await fs.unlink(localPath(key)).catch(() => undefined);
}

export async function presignPut(
  key: string,
  contentType: string,
  maxBytes: number,
  expiresSeconds = 300,
): Promise<{ uploadUrl: string; headers: Record<string, string>; backend: "s3" } | null> {
  const c = client();
  if (!c) return null;
  const cmd = new PutObjectCommand({
    Bucket: c.bucket,
    Key: key,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  });
  const uploadUrl = await getSignedUrl(c.s3, cmd, { expiresIn: expiresSeconds });
  return {
    uploadUrl,
    headers: { "Content-Type": contentType, "X-Max-Bytes": String(maxBytes) },
    backend: "s3",
  };
}

export function publicUrlFor(key: string): string {
  const c = client();
  if (c?.publicBase) return `${c.publicBase}/${key}`;
  return `/media/${path.posix.basename(key)}`;
}
