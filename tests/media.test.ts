import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { mediaAssets, users } from "@/lib/db/schema";
import { createSite } from "@/lib/sites";
import { beginUpload, confirmUpload, listMedia, readMediaFile, uploadMedia, MAX_IMAGE_BYTES } from "@/lib/media";
import { sniffMime, probeDimensions } from "@/lib/media";
import { storageBackend } from "@/lib/media/storage";
import type { Actor } from "@/lib/auth/session";
import { adminActor } from "./support/actor";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==",
  "base64",
);

let actor: Actor;
let siteId: string;

beforeAll(async () => {
  await ensureDb();
  actor = await adminActor();
  const site = await createSite({ name: "Media Test", slug: `media-test-${Date.now()}`, createdBy: actor.user.id });
  siteId = site.id;
});

describe("byte inspection", () => {
  it("recognises a PNG by its magic bytes, not its name", () => {
    expect(sniffMime(PNG)?.mime).toBe("image/png");
  });

  it("refuses a file that is nothing it claims to be", () => {
    expect(sniffMime(Buffer.from("just some words"))).toBeNull();
  });

  it("reads PNG dimensions from the header", () => {
    expect(probeDimensions(PNG, "image/png")).toEqual({ width: 1, height: 1 });
  });

  it("survives a truncated header", () => {
    expect(probeDimensions(Buffer.from([0xff, 0xd8]), "image/jpeg")).toEqual({ width: null, height: null });
  });
});

describe("upload lifecycle", () => {
  it("runs locally in this environment", () => {
    expect(storageBackend()).toBe("local");
  });

  it("creates a pending row that is not listed as usable", async () => {
    const started = await beginUpload({
      siteId,
      filename: "pending.png",
      contentType: "image/png",
      sizeBytes: PNG.length,
      actor,
    });
    expect(started.uploadUrl).toBeNull();
    expect(started.storageKey).toContain("pending-");
    const library = await listMedia(siteId);
    expect(library.find((asset) => asset.id === started.mediaId)).toBeUndefined();
  });

  it("refuses to confirm a row whose bytes were never written", async () => {
    const started = await beginUpload({
      siteId,
      filename: "missing.png",
      contentType: "image/png",
      sizeBytes: PNG.length,
      actor,
    });
    await expect(
      confirmUpload({ siteId, mediaId: started.mediaId, actor }),
    ).rejects.toThrow(/never written/);
  });

  it("promotes a real upload to ready with a content-hashed key", async () => {
    const { asset } = await uploadMedia({ siteId, bytes: PNG, filename: "dot.png", actor });
    expect(asset.status).toBe("ready");
    expect(asset.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.storageKey).toMatch(/\/[a-f0-9]{16}\.png$/);
    expect(await listMedia(siteId)).toHaveLength(1);
  });

  it("serves the stored bytes back through the media reader", async () => {
    const [asset] = await listMedia(siteId);
    const bytes = await readMediaFile(asset.publicUrl);
    expect(bytes?.length).toBe(PNG.length);
  });

  it("deduplicates identical bytes into the existing row", async () => {
    const again = await uploadMedia({ siteId, bytes: PNG, filename: "copy.png", actor });
    expect(again.deduplicated).toBe(true);
    expect(await listMedia(siteId)).toHaveLength(1);
  });

  it("rejects a file over the cap before touching storage", async () => {
    const huge = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    await expect(uploadMedia({ siteId, bytes: huge, filename: "huge.png", actor })).rejects.toThrow(/5 MB/);
  });

  it("rejects a type mismatch at begin", async () => {
    await expect(
      beginUpload({ siteId, filename: "x.exe", contentType: "application/x-msdownload", sizeBytes: 10, actor }),
    ).rejects.toThrow(/not accepted/);
  });

  it("keeps pending rows out of the media map", async () => {
    const [pending] = await db
      .select()
      .from(mediaAssets)
      .where(eq(mediaAssets.status, "pending"))
      .limit(1);
    expect(pending?.checksum.startsWith("pending:")).toBe(true);
  });
});
