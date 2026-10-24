import { createHash, randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

const MEMORY_COST = 19456;
const TIME_COST = 2;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { memoryCost: MEMORY_COST, timeCost: TIME_COST, parallelism: 1 });
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  try {
    return await verify(stored, password);
  } catch {
    return false;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export type PasswordCheck = { ok: true } | { ok: false; message: string };

export function checkPasswordStrength(password: string): PasswordCheck {
  if (password.length < 10) return { ok: false, message: "Use at least 10 characters." };
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return { ok: false, message: "Mix letters and numbers." };
  }
  if (/^(password|trofeo|letmein|qwerty)/i.test(password)) {
    return { ok: false, message: "That password is too easy to guess." };
  }
  return { ok: true };
}
