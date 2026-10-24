"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export interface RealtimeRefreshOptions {
  readonly endpoint?: string;
  readonly topics?: readonly string[];
  readonly enabled?: boolean;
}

export function useRealtimeRefresh(options: RealtimeRefreshOptions = {}): void {
  const router = useRouter();
  const endpoint = options.endpoint ?? "/api/realtime";
  const enabled = options.enabled ?? true;
  const topicsKey = options.topics ? options.topics.join(",") : "";

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") {
      return undefined;
    }
    const allowedTopics = topicsKey ? new Set(topicsKey.split(",")) : null;
    const source = new EventSource(endpoint);
    const onMessage = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as { topic?: string };
        if (
          !allowedTopics ||
          (parsed.topic && allowedTopics.has(parsed.topic))
        ) {
          router.refresh();
        }
      } catch {
        router.refresh();
      }
    };
    source.addEventListener("account_changed", onMessage as EventListener);
    return () => {
      source.removeEventListener("account_changed", onMessage as EventListener);
      source.close();
    };
  }, [enabled, endpoint, router, topicsKey]);
}
