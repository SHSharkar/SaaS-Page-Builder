import "server-only";
import { hash, verify } from "@node-rs/argon2";

const ARGON_OPTIONS = {
  memoryCost: 19_456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  const normalized = password.normalize("NFKC");
  if (normalized.length < 10 || normalized.length > 128) {
    throw new Error("Password must be between 10 and 128 characters");
  }
  return hash(normalized, ARGON_OPTIONS);
}

export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  const normalized = password.normalize("NFKC");
  return verify(storedHash, normalized);
}
