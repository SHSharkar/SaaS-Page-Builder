import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function resolveKey(): Buffer {
  const raw =
    process.env.SETTINGS_ENCRYPTION_KEY ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : (process.env.BETTER_AUTH_SECRET ?? "trofeo-pages-dev-encryption-material-32-chars"));

  if (!raw || raw.length < 16) {
    throw new Error("SETTINGS_ENCRYPTION_KEY must be set to at least 16 characters in production.");
  }

  return Buffer.from(hkdfSync("sha256", Buffer.from(raw, "utf8"), Buffer.from("trofeo-pages-settings-v1"), Buffer.from("aes-256-gcm"), 32));
}

export function encryptSecret(plaintext: string): string {
  const key = resolveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivPart, tagPart, dataPart] = payload.split(":");
  if (version !== "v1" || !ivPart || !tagPart || dataPart === undefined) {
    throw new Error("Stored secret ciphertext has an unrecognized format.");
  }
  const key = resolveKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
