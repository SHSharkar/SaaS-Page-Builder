import { canIssueCertificate } from "@/lib/domains";
import { methodNotAllowed, problemFromError, problemResponse } from "@/lib/problem";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const expectedToken = process.env.INTERNAL_TLS_CHECK_TOKEN?.trim();
  if (expectedToken) {
    const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    if (provided !== expectedToken) {
      return problemResponse({
        status: 401,
        title: "Unauthorized",
        detail: "Valid internal token is required for certificate checks.",
        requestId,
      });
    }
  }

  try {
    const url = new URL(request.url);
    const domain = url.searchParams.get("domain")?.trim() ?? "";
    if (!domain) {
      return problemResponse({
        status: 400,
        title: "Bad Request",
        detail: "Query parameter 'domain' is required.",
        requestId,
      });
    }

    const allowed = await canIssueCertificate(domain);
    if (!allowed) {
      return problemResponse({
        status: 403,
        title: "Forbidden",
        detail: "Domain is not verified on an active site.",
        requestId,
      });
    }

    return Response.json(
      { ok: true, domain },
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
