import type { NextRequest } from "next/server";
import { problemResponse } from "@/app/server/api/problem";
import {
  AuthorizationError,
  requireAccountCapability,
} from "@/app/server/auth/guards";
import { subscribeAccountEvents } from "@/app/server/realtime/listener";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  let accountId: string;
  try {
    const actor = await requireAccountCapability("workspace.view");
    accountId = actor.account.id;
  } catch (err) {
    const status = err instanceof AuthorizationError ? err.statusCode : 401;
    return problemResponse({
      status,
      title: "Unauthorized",
      detail: "Active workspace session required for realtime stream",
    });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(": connected\n\n"));
      unsubscribe = await subscribeAccountEvents((rawPayload) => {
        try {
          const parsed = JSON.parse(rawPayload) as { accountId?: string };
          if (parsed.accountId === accountId) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`),
            );
          }
        } catch {
          return;
        }
      });
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 20_000);
      request.signal.addEventListener("abort", () => {
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
      });
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
