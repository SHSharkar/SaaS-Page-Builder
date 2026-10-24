import type { NextRequest } from "next/server";
import { problemResponse } from "@/app/server/api/problem";
import {
  AuthorizationError,
  requirePlatformCapability,
} from "@/app/server/auth/guards";
import { subscribeAccountEvents } from "@/app/server/realtime/listener";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await requirePlatformCapability("platform.console.view");
  } catch (err) {
    const status = err instanceof AuthorizationError ? err.statusCode : 403;
    return problemResponse({
      status,
      title: "Forbidden",
      detail: "Platform operator session required",
    });
  }

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(": platform-connected\n\n"));
      unsubscribe = await subscribeAccountEvents((rawPayload) => {
        controller.enqueue(encoder.encode(`data: ${rawPayload}\n\n`));
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
