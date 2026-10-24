import { NextResponse } from "next/server";
import { problemResponse } from "@/app/server/api/problem";
import { CircuitBreaker } from "@/app/server/breaker";
import { dbPing } from "@/app/server/db/client";
import { valkeyPing } from "@/app/server/redis/client";

export const dynamic = "force-dynamic";

const postgresBreaker = new CircuitBreaker("postgres-ready");
const valkeyBreaker = new CircuitBreaker("valkey-ready");

export async function GET(): Promise<Response> {
  try {
    const pgOk = await postgresBreaker.execute(() => dbPing());
    const redisOk = await valkeyBreaker.execute(() => valkeyPing());
    if (!pgOk || !redisOk) {
      return problemResponse({
        status: 503,
        title: "Service Not Ready",
        detail: "PostgreSQL or Valkey readiness check returned false",
      });
    }
    return NextResponse.json(
      {
        status: "ready",
        postgres: "ok",
        valkey: "ok",
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return problemResponse({
      status: 503,
      title: "Service Unavailable",
      detail: "One or more backing stores failed readiness verification",
    });
  }
}
