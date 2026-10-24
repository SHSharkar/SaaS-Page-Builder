import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";
import { getEnv } from "@/app/server/env";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

function hexKeyToBuffer(hexKey: string): Buffer {
  const buf = Buffer.from(hexKey, "hex");
  if (buf.byteLength !== 32) {
    throw new Error("Encryption key must decode to 32 bytes");
  }
  return buf;
}

function sealWithHexKey(
  plaintext: string,
  hexKey: string,
  prefix: string,
): string {
  const key = hexKeyToBuffer(hexKey);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${prefix}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function openWithHexKey(
  ciphertext: string,
  hexKey: string,
  prefix: string,
): string {
  const [ver, ivPart, tagPart, bodyPart] = ciphertext.split(":");
  if (ver !== prefix || !ivPart || !tagPart || bodyPart === undefined) {
    throw new Error("Invalid sealed ciphertext envelope");
  }
  const key = hexKeyToBuffer(hexKey);
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(bodyPart, "base64url")),
    decipher.final(),
  ]);
  return plain.toString("utf8");
}

export function encryptField(plaintext: string): string {
  return sealWithHexKey(plaintext, getEnv().SETTINGS_ENCRYPTION_KEY, "fld1");
}

export function decryptField(ciphertext: string): string {
  return openWithHexKey(ciphertext, getEnv().SETTINGS_ENCRYPTION_KEY, "fld1");
}

export function encryptContact(contactValue: string): string {
  return sealWithHexKey(contactValue, getEnv().GUEST_CONTACT_KEY, "cnt1");
}

export function decryptContact(ciphertext: string): string {
  return openWithHexKey(ciphertext, getEnv().GUEST_CONTACT_KEY, "cnt1");
}

export function computeLookupHash(scope: string, rawValue: string): string {
  return createHmac("sha256", Buffer.from(getEnv().GUEST_LOOKUP_KEY, "hex"))
    .update(`${scope}:${rawValue.trim().toLowerCase()}`)
    .digest("hex");
}

export function deriveDurableScanCode(
  accountId: string,
  siteId: string,
): string {
  const digest = createHmac(
    "sha256",
    Buffer.from(getEnv().GUEST_LOOKUP_KEY, "hex"),
  )
    .update(`scan:${accountId}:${siteId}`)
    .digest();
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 16; i += 1) {
    const b = digest[i] ?? 0;
    out += alphabet[b % alphabet.length];
  }
  return out;
}
