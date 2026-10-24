import { NextResponse } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/cache";
import { beginUpload, MAX_IMAGE_BYTES } from "@/lib/media";

export const dynamic = "force-dynamic";

/**
 * Step one of the two-step upload: create a `pending` row and hand back a
 * presigned PUT when the bucket is configured. The row is invisible to the
 * library and to the renderer until `…/<mediaId>/confirm` verifies the bytes.
 */
export async function POST(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!can(actor, "editor")) {
    return NextResponse.json({ error: "Your role cannot upload media." }, { status: 403 });
  }
  if (!consumeRateLimit(`upload:${actor.user.id}`, 60, 3600)) {
    return NextResponse.json({ error: "That is 60 uploads this hour. Slow down a little." }, { status: 429 });
  }

  const { siteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    filename?: string;
    contentType?: string;
    size?: number;
  };

  try {
    const upload = await beginUpload({
      siteId,
      filename: body.filename ?? "upload",
      contentType: body.contentType ?? "application/octet-stream",
      sizeBytes: Number(body.size ?? 0),
      actor,
    });
    return NextResponse.json({
      ...upload,
      /** Null means storage is local: post the bytes to the upload route instead. */
      direct: upload.uploadUrl !== null,
      maxBytes: MAX_IMAGE_BYTES,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not start the upload." },
      { status: 400 },
    );
  }
}
