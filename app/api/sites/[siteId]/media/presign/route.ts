import { can } from "@/lib/auth/permissions";
import { getActor } from "@/lib/auth/session";
import { requestMediaUpload } from "@/lib/media";
import { methodNotAllowed, problemFromError, problemResponse } from "@/lib/problem";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const actor = await getActor();
  if (!actor) {
    return problemResponse({
      status: 401,
      title: "Authentication required",
      detail: "Sign in before starting an upload.",
      requestId,
    });
  }
  if (!can(actor, "media.upload")) {
    return problemResponse({
      status: 403,
      title: "Forbidden",
      detail: "Your role does not include media.upload.",
      requestId,
    });
  }

  try {
    const { siteId } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      filename?: string;
      contentType?: string;
      size?: number;
      checksum?: string;
      altText?: string;
    };

    const grant = await requestMediaUpload({
      siteId,
      filename: body.filename ?? "upload",
      mimeType: body.contentType ?? "application/octet-stream",
      sizeBytes: Number(body.size ?? 0),
      checksum: body.checksum,
      altText: body.altText,
      actor,
    });

    return Response.json(grant, {
      status: 200,
      headers: { "X-Request-Id": requestId },
    });
  } catch (err) {
    return problemFromError(err, requestId);
  }
}

export function GET(request: Request) {
  return methodNotAllowed(["POST"], request.headers.get("x-request-id") ?? undefined);
}

export function PUT(request: Request) {
  return methodNotAllowed(["POST"], request.headers.get("x-request-id") ?? undefined);
}

export function DELETE(request: Request) {
  return methodNotAllowed(["POST"], request.headers.get("x-request-id") ?? undefined);
}
