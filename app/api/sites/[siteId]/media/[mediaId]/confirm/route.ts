import { can } from "@/lib/auth/permissions";
import { getActor } from "@/lib/auth/session";
import { confirmPresignedUpload } from "@/lib/media";
import { methodNotAllowed, problemFromError, problemResponse } from "@/lib/problem";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ siteId: string; mediaId: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const actor = await getActor();
  if (!actor) {
    return problemResponse({
      status: 401,
      title: "Authentication required",
      detail: "Sign in before confirming an upload.",
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
    const { siteId, mediaId } = await params;
    const { asset, deduplicated } = await confirmPresignedUpload(siteId, mediaId, actor);
    return Response.json(
      {
        asset: {
          id: asset.id,
          url: asset.publicUrl,
          alt: asset.altText ?? "",
          width: asset.width,
          height: asset.height,
        },
        deduplicated,
      },
      { status: 200, headers: { "X-Request-Id": requestId } },
    );
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
