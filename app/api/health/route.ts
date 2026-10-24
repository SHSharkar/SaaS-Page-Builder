import { sql } from "drizzle-orm";
import { databaseBackend, db, ensureDb } from "@/lib/db";
import { cacheBackend } from "@/lib/cache";
import { storageBackend } from "@/lib/media/storage";
import { methodNotAllowed, problemFromError } from "@/lib/problem";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  try {
    await ensureDb();
    await db.execute(sql`select 1`);
    return Response.json(
      {
        status: "ok",
        database: databaseBackend(),
        cache: cacheBackend(),
        storage: storageBackend(),
        timestamp: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Request-Id": requestId,
        },
      },
    );
  } catch (err) {
    return problemFromError(err, requestId);
  }
}

export function POST(request: Request) {
  return methodNotAllowed(["GET"], request.headers.get("x-request-id") ?? undefined);
}

export function PUT(request: Request) {
  return methodNotAllowed(["GET"], request.headers.get("x-request-id") ?? undefined);
}

export function DELETE(request: Request) {
  return methodNotAllowed(["GET"], request.headers.get("x-request-id") ?? undefined);
}
