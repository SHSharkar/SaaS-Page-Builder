import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { problemResponse } from "@/app/server/api/problem";
import { getEnv } from "@/app/server/env";
import {
  claimWebhookEventOnce,
  verifyHmacWebhookSignature,
} from "@/app/server/webhooks";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("x-webhook-signature");
  const env = getEnv();

  if (
    !verifyHmacWebhookSignature({
      rawBody,
      secret: env.INTERNAL_TLS_CHECK_TOKEN,
      signatureHeader,
    })
  ) {
    return problemResponse({
      status: 401,
      title: "Invalid Signature",
      detail: "Domain TLS webhook signature verification failed",
    });
  }

  let parsed: { id?: string };
  try {
    parsed = JSON.parse(rawBody) as { id?: string };
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
      detail: "Webhook event id is required",
    });
  }

  const fresh = await claimWebhookEventOnce("domain-tls", parsed.id);
  return NextResponse.json({ received: true, deduplicated: !fresh });
}
