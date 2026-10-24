import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { getEnv } from "@/app/server/env";
import { getRedisClient } from "@/app/server/redis/client";

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

export function createStripeClient(): Stripe {
  return new Stripe(getEnv().STRIPE_SECRET_KEY);
}

interface StripeSignatureParts {
  readonly timestamp: string;
  readonly signatures: readonly string[];
}

function parseStripeSignature(header: string): StripeSignatureParts | null {
  const timestamp: string[] = [];
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, value] = part.split("=");
    if (!key || !value) {
      continue;
    }
    if (key.trim() === "t") {
      timestamp.push(value.trim());
    }
    if (key.trim() === "v1") {
      signatures.push(value.trim());
    }
  }
  const [firstTimestamp] = timestamp;
  if (!firstTimestamp || signatures.length === 0) {
    return null;
  }
  return { timestamp: firstTimestamp, signatures };
}

export function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret?: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): boolean {
  if (!input.signatureHeader) {
    return false;
  }
  const parts = parseStripeSignature(input.signatureHeader);
  if (!parts) {
    return false;
  }
  const secret = input.secret ?? getEnv().STRIPE_WEBHOOK_SECRET;
  const tolerance =
    input.toleranceSeconds ?? STRIPE_SIGNATURE_TOLERANCE_SECONDS;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const timestamp = Number(parts.timestamp);
  if (!Number.isFinite(timestamp) || Math.abs(now - timestamp) > tolerance) {
    return false;
  }
  const expected = createHmac("sha256", secret)
    .update(`${parts.timestamp}.${input.rawBody}`, "utf8")
    .digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return parts.signatures.some((signature) => {
    const candidate = Buffer.from(signature, "utf8");
    return (
      candidate.byteLength === expectedBuffer.byteLength &&
      timingSafeEqual(candidate, expectedBuffer)
    );
  });
}

export function verifyHmacWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret?: string;
}): boolean {
  if (!input.signatureHeader) {
    return false;
  }
  const secret = input.secret ?? getEnv().INTERNAL_TLS_CHECK_TOKEN;
  const expected = createHmac("sha256", secret)
    .update(input.rawBody, "utf8")
    .digest("hex");
  const candidate = input.signatureHeader.replace(/^sha256=/, "").trim();
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(candidate, "utf8");
  if (a.byteLength !== b.byteLength) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export async function claimWebhookEventOnce(
  provider: string,
  eventId: string,
  ttlSeconds = 86_400,
): Promise<boolean> {
  const key = `webhook:dedup:${provider}:${eventId}`;
  const set = await getRedisClient().set(key, "1", "EX", ttlSeconds, "NX");
  return set === "OK";
}
