import { can } from "@/lib/auth/permissions";
import { getActor } from "@/lib/auth/session";
import { listMedia, uploadMedia } from "@/lib/media";
import { methodNotAllowed, problemFromError, problemResponse } from "@/lib/problem";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ siteId: string }> },
) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const actor = await getActor();
  if (!actor) {
    return problemResponse({
      status: 401,
      title: "Authentication required",
      detail: "Sign in before listing media.",
      requestId,
    });
  }
  if (!can(actor, "media.view")) {
    return problemResponse({
      status: 403,
      title: "Forbidden",
      detail: "Your role does not include media.view.",
      requestId,
    });
  }

  try {
    const { siteId } = await params;
    const rows = await listMedia(siteId);
    return Response.json(
      {
        media: rows
          .filter((row) => row.kind !== "import_reference" && Boolean(row.publicUrl))
          .map((row) => ({
            id: row.id,
            url: row.publicUrl,
            alt: row.altText ?? "",
            width: row.width,
            height: row.height,
          })),
      },
      { headers: { "X-Request-Id": requestId } },
    );
  } catch (err) {
    return problemFromError(err, requestId);
  }
}

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
      detail: "Sign in before uploading media.",
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
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return problemResponse({
        status: 400,
        title: "Validation failed",
        detail: "Attach a file under the 'file' field.",
        requestId,
      });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const { asset, deduplicated } = await uploadMedia({
      siteId,
      bytes,
      filename: file.name || "upload",
      mimeType: file.type || "application/octet-stream",
      actor,
    });

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
      { status: 201, headers: { "X-Request-Id": requestId } },
    );
  } catch (err) {
    return problemFromError(err, requestId);
  }
}

export function PUT(request: Request) {
  return methodNotAllowed(["GET", "POST"], request.headers.get("x-request-id") ?? undefined);
}

export function DELETE(request: Request) {
  return methodNotAllowed(["GET", "POST"], request.headers.get("x-request-id") ?? undefined);
}
