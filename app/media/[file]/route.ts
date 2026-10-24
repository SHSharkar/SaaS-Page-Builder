import { and, eq } from "drizzle-orm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { db, ensureDb } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { MEDIA_DIR } from "@/lib/media";

/**
 * Media is addressed by content hash, so a URL is immutable: the same file
 * always has the same name. In production this route is replaced by the R2
 * public bucket; identifiers in documents stay identical.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-zA-Z0-9._-]+$/.test(file)) {
    return new Response("Not found", { status: 404 });
  }

  await ensureDb();
  const [asset] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.publicUrl, `/media/${file}`), eq(mediaAssets.status, "ready")))
    .limit(1);

  if (!asset) return new Response("Not found", { status: 404 });

  try {
    const bytes = await readFile(path.join(MEDIA_DIR, asset.storageKey));
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: `"${asset.checksum.slice(0, 32)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
