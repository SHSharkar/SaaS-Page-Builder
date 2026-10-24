import "server-only";
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "@/app/server/env";

export type BucketKind = "upload" | "backup";

function createS3Client(kind: BucketKind): {
  client: S3Client;
  bucket: string;
  publicBaseUrl: string;
} {
  const env = getEnv();
  if (kind === "upload") {
    return {
      client: new S3Client({
        region: "auto",
        endpoint: env.R2_UPLOAD_ENDPOINT,
        credentials: {
          accessKeyId: env.R2_UPLOAD_ACCESS_KEY_ID,
          secretAccessKey: env.R2_UPLOAD_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
      }),
      bucket: env.R2_UPLOAD_BUCKET,
      publicBaseUrl: env.R2_UPLOAD_PUBLIC_URL.replace(/\/+$/, ""),
    };
  }
  return {
    client: new S3Client({
      region: "auto",
      endpoint: env.R2_BACKUP_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_BACKUP_ACCESS_KEY_ID,
        secretAccessKey: env.R2_BACKUP_SECRET_ACCESS_KEY,
      },
      forcePathStyle: true,
    }),
    bucket: env.R2_BACKUP_BUCKET,
    publicBaseUrl: "",
  };
}

export async function createPresignedUploadUrl(input: {
  storageKey: string;
  contentType: string;
  expiresInSeconds?: number;
}): Promise<{ uploadUrl: string; publicUrl: string }> {
  const { client, bucket, publicBaseUrl } = createS3Client("upload");
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: input.storageKey,
    ContentType: input.contentType,
  });
  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 300,
  });
  return {
    uploadUrl,
    publicUrl: `${publicBaseUrl}/${input.storageKey}`,
  };
}

export async function createPresignedDownloadUrl(input: {
  kind: BucketKind;
  storageKey: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { client, bucket } = createS3Client(input.kind);
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: input.storageKey,
  });
  return getSignedUrl(client, command, {
    expiresIn: input.expiresInSeconds ?? 120,
  });
}
