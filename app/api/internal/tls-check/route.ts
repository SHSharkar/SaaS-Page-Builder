import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { problemResponse } from "@/app/server/api/problem";
import { checkTlsDomainAllowed } from "@/app/server/domains";
import { getEnv } from "@/app/server/env";

export const dynamic = "force-dynamic";

function secretsMatch(candidate: string, expected: string): boolean {
  const a = createHash("sha256").update(candidate, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest): Promise<Response> {
  const env = getEnv();
  const provided = request.headers.get("x-tls-probe-secret") ?? "";
  if (!provided || !secretsMatch(provided, env.INTERNAL_TLS_CHECK_TOKEN)) {
    return problemResponse({
      status: 401,
      title: "Unauthorized",
      detail: "Valid X-Tls-Probe-Secret header is required",
    });
  }

  const domain = request.nextUrl.searchParams.get("domain") ?? "";
  if (!domain) {
    return problemResponse({
      status: 400,
      title: "Bad Request",
      detail: "Query parameter domain is required",
    });
  }

  const allowed = await checkTlsDomainAllowed(domain);
  if (!allowed) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return new NextResponse("OK", { status: 200 });
}
