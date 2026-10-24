import { and, eq, isNull } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { problemResponse } from "@/app/server/api/problem";
import {
  AuthorizationError,
  requireAccountCapability,
} from "@/app/server/auth/guards";
import { mediaAssets } from "@/app/server/db/schema";
import { withAccount } from "@/app/server/db/with-account";
import { createPresignedDownloadUrl } from "@/app/server/storage/r2";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const actor = await requireAccountCapability("media.view");
    const { id } = await context.params;
    const [asset] = await withAccount(actor.account.id, (tx) =>
      tx
        .select()
        .from(mediaAssets)
        .where(and(eq(mediaAssets.id, id), isNull(mediaAssets.deletedAt)))
        .limit(1),
    );
    if (!asset) {
      return problemResponse({
        status: 404,
        title: "Not Found",
        detail: "Media asset not found in workspace",
      });
    }
    const signedUrl = await createPresignedDownloadUrl({
      kind: "upload",
      storageKey: asset.storageKey,
    });
    return NextResponse.redirect(signedUrl, 302);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return problemResponse({
        status: err.statusCode,
        title: "Forbidden",
        detail: err.message,
      });
    }
    return problemResponse({
      status: 500,
      title: "Internal Server Error",
      detail: "Unable to resolve media asset",
    });
  }
}
