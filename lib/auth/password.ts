import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

const ARGON_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain.normalize("NFKC"), ARGON_OPTIONS);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(storedHash, plain.normalize("NFKC"));
  } catch {
    return false;
  }
}

export type PasswordStrengthResult = { ok: true } | { ok: false; message: string };

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const normalized = password.normalize("NFKC");
  if (normalized.length < 10) {
    return { ok: false, message: "Use at least 10 characters." };
  }
  if (normalized.length > 128) {
    return { ok: false, message: "Passwords are capped at 128 characters." };
  }
  if (!/[A-Za-z]/.test(normalized) || !/[0-9]/.test(normalized)) {
    return { ok: false, message: "Include both letters and numbers." };
  }
  return { ok: true };
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
