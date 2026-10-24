import "server-only";
import { Secret, TOTP } from "otpauth";

export function createTotpSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function generateTotpCode(
  secretBase32: string,
  accountLabel: string,
): string {
  const totp = new TOTP({
    issuer: "SaaS Page Builder",
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}

export function verifyTotpCode(
  secretBase32: string,
  accountLabel: string,
  token: string,
): boolean {
  const totp = new TOTP({
    issuer: "SaaS Page Builder",
    label: accountLabel,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(secretBase32),
  });
  return totp.validate({ token, window: 1 }) !== null;
}
