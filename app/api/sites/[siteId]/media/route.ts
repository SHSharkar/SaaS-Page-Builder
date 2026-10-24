import { NextResponse } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { consumeRateLimit } from "@/lib/cache";
import { listMedia, uploadMedia } from "@/lib/media";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { siteId } = await params;
  const rows = await listMedia(siteId);
  return NextResponse.json({
    media: rows.map((row) => ({
      id: row.id,
      url: row.publicUrl,
      alt: row.altText ?? undefined,
      width: row.width,
      height: row.height,
    })),
  });
}

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
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "Files are capped at 5 MB." }, { status: 413 });
  }

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const { asset, deduplicated } = await uploadMedia({
      siteId,
      bytes,
      filename: file.name || "upload",
      actor,
    });
    return NextResponse.json({
      asset: {
        id: asset.id,
        url: asset.publicUrl,
        alt: asset.altText ?? undefined,
        width: asset.width,
        height: asset.height,
      },
      deduplicated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
