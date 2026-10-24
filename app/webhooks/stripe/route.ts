import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { problemResponse } from "@/app/server/api/problem";
import { getEnv } from "@/app/server/env";
import {
  claimWebhookEventOnce,
  verifyStripeWebhookSignature,
} from "@/app/server/webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");
  const env = getEnv();

  if (
    !verifyStripeWebhookSignature({
      rawBody,
      secret: env.STRIPE_WEBHOOK_SECRET,
      signatureHeader,
    })
  ) {
    return problemResponse({
      status: 401,
      title: "Invalid Signature",
      detail: "Stripe webhook signature verification failed",
    });
  }

  let parsed: { id?: string; type?: string };
  try {
    parsed = JSON.parse(rawBody) as { id?: string; type?: string };
  } catch {
    return problemResponse({
      status: 400,
      title: "Invalid JSON",
      detail: "Webhook payload must be valid JSON",
    });
  }

  if (!parsed.id) {
    return problemResponse({
      status: 400,
      title: "Missing Event ID",
      detail: "Webhook event id is required for deduplication",
    });
  }

  const fresh = await claimWebhookEventOnce("stripe", parsed.id);
  return NextResponse.json({ received: true, deduplicated: !fresh });
}
