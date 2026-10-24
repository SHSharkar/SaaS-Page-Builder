import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { mediaAssets } from "@/lib/db/schema";
import { createSite } from "@/lib/sites";
import {
  MAX_UPLOAD_BYTES,
  confirmPresignedUpload,
  deleteMedia,
  listMedia,
  probeDimensions,
  readMediaFile,
  requestMediaUpload,
  sanitizeSvg,
  sniffMime,
  uploadMedia,
} from "@/lib/media";
import { storageBackend } from "@/lib/media/storage";
import { createPage, saveDraft, newPageDocument } from "@/lib/pages";
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
  const site = await createSite({
    name: "Media Test",
    slug: `media-test-${Date.now()}`,
    createdBy: actor.user.id,
  });
  siteId = site.id;
});

describe("byte inspection and SVG sanitization", () => {
  it("recognizes a PNG by its magic bytes, not its name", () => {
    expect(sniffMime(PNG)?.mime).toBe("image/png");
  });

  it("refuses a file that is nothing it claims to be", () => {
    expect(sniffMime(Buffer.from("just some words"))).toBeNull();
  });

  it("reads PNG dimensions from the header", () => {
    expect(probeDimensions(PNG, "image/png")).toEqual({ width: 1, height: 1 });
  });

  it("survives a truncated header", () => {
    expect(probeDimensions(Buffer.from([0xff, 0xd8]), "image/jpeg")).toEqual({
      width: null,
      height: null,
    });
  });

  it("strips scripts, event handlers and javascript links from SVG files", () => {
    const dirty =
      '<svg onclick="alert(1)"><script>evil()</script><a href="javascript:alert(2)"><rect width="10" height="10"/></a></svg>';
    const clean = sanitizeSvg(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain("<rect");
  });
});

describe("upload lifecycle and reference guard", () => {
  it("runs locally in this environment", () => {
    expect(storageBackend()).toBe("local");
  });

  it("grants direct upload mode locally and rejects unsupported MIME types", async () => {
    const grant = await requestMediaUpload({
      siteId,
      filename: "pending.png",
      mimeType: "image/png",
      sizeBytes: PNG.length,
      actor,
    });
    expect(grant.mode).toBe("direct");

    await expect(
      requestMediaUpload({
        siteId,
        filename: "x.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 10,
        actor,
      }),
    ).rejects.toThrow(/not supported/);
  });

  it("refuses to confirm an unknown pending upload", async () => {
    await expect(
      confirmPresignedUpload(siteId, "00000000-0000-0000-0000-000000000000", actor),
    ).rejects.toThrow(/not found/);
  });

  it("promotes a real upload to ready with a content-hashed key", async () => {
    const { asset } = await uploadMedia({ siteId, bytes: PNG, filename: "dot.png", actor });
    expect(asset.status).toBe("ready");
    expect(asset.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.width).toBe(1);
    expect(asset.height).toBe(1);
    expect(await listMedia(siteId)).toHaveLength(1);
  });

  it("serves the stored bytes back through the media reader", async () => {
    const [asset] = await listMedia(siteId);
    const filename = asset.publicUrl.replace(/^\/media\//, "");
    const resolved = await readMediaFile(filename);
    expect(resolved?.bytes.length).toBe(PNG.length);
    expect(resolved?.mime).toBe("image/png");
  });

  it("deduplicates identical bytes into the existing row", async () => {
    const again = await uploadMedia({ siteId, bytes: PNG, filename: "copy.png", actor });
    expect(again.deduplicated).toBe(true);
    expect(await listMedia(siteId)).toHaveLength(1);
  });

  it("rejects a file over the cap before touching storage", async () => {
    const huge = Buffer.alloc(MAX_UPLOAD_BYTES + 1);
    await expect(
      uploadMedia({ siteId, bytes: huge, filename: "huge.png", actor }),
    ).rejects.toThrow(/10 MB/);
  });

  it("blocks deleting a referenced media asset until forced", async () => {
    const [asset] = await listMedia(siteId);
    const page = await createPage({
      siteId,
      title: "Uses Image",
      slug: "uses-image",
      actor,
    });
    await saveDraft(
      siteId,
      page.id,
      {
        ...newPageDocument(),
        content: [
          {
            type: "hero",
            props: { id: "hero-media-ref", backgroundImage: { id: asset.id } },
          },
        ],
      },
      page.lockVersion,
      actor,
    );

    await expect(deleteMedia(siteId, asset.id, actor, false)).rejects.toThrow(/used in/i);
    await deleteMedia(siteId, asset.id, actor, true);
    const rows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, asset.id));
    expect(rows).toHaveLength(0);
  });
});
