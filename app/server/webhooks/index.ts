import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import Stripe from "stripe";
import { getEnv } from "@/app/server/env";
import { getRedisClient } from "@/app/server/redis/client";

export function createStripeClient(): Stripe {
  return new Stripe(getEnv().STRIPE_SECRET_KEY);
}

export function verifyHmacWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret?: string;
}): boolean {
  if (!input.signatureHeader) {
    return false;
  }
  const secret = input.secret ?? getEnv().STRIPE_WEBHOOK_SECRET;
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
