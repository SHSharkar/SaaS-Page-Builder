"use client";

import { useRealtimeRefresh } from "@/hooks/use-realtime-refresh";

export interface RealtimeListenerProps {
  readonly endpoint?: string;
}

export function RealtimeListener({
  endpoint = "/api/realtime",
}: RealtimeListenerProps) {
  useRealtimeRefresh({ enabled: true, endpoint });
  return null;
}
