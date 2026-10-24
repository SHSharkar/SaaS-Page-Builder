import { and, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { getObject, storageBackend } from "@/lib/media/storage";

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

  const bytes = await getObject(asset.storageKey);
  if (!bytes) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": asset.mimeType,
      "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: `"${asset.checksum.slice(0, 32)}"`,
      "X-Content-Type-Options": "nosniff",
      "X-Media-Backend": storageBackend(),
    },
  });
}
