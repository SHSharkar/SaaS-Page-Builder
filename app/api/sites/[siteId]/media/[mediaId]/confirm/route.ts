import { NextResponse } from "next/server";
import { can, getActor } from "@/lib/auth/session";
import { confirmUpload } from "@/lib/media";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ siteId: string; mediaId: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!can(actor, "editor")) {
    return NextResponse.json({ error: "Your role cannot upload media." }, { status: 403 });
  }

  const { siteId, mediaId } = await params;
  const body = (await request.json().catch(() => ({}))) as { checksum?: string };

  try {
    const asset = await confirmUpload({ siteId, mediaId, actor, expectedChecksum: body.checksum });
    return NextResponse.json({
      asset: {
        id: asset.id,
        url: asset.publicUrl,
        alt: asset.altText ?? undefined,
        width: asset.width,
        height: asset.height,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The upload could not be confirmed." },
      { status: 400 },
    );
  }
}
