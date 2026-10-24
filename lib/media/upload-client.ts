/**
 * The browser half of the two-step upload, shared by the editor's media field
 * and the library screen.
 *
 * With R2 configured the bytes go straight to the bucket through a presigned
 * PUT; without it they post to our own route. Either way the row only becomes
 * `ready` after the server has read the bytes back and verified them.
 */
export type UploadedAsset = {
  id: string;
  url: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
};

type PresignResponse = {
  mediaId?: string;
  uploadUrl?: string | null;
  headers?: Record<string, string>;
  direct?: boolean;
  error?: string;
};

async function sha256Hex(file: File): Promise<string | undefined> {
  if (typeof crypto === "undefined" || !crypto.subtle) return undefined;
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return undefined;
  }
}

export async function uploadFile(siteId: string, file: File): Promise<UploadedAsset & { deduplicated?: boolean }> {
  const start = await fetch(`/api/sites/${siteId}/media/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
    }),
  });
  const presign = (await start.json()) as PresignResponse;
  if (!start.ok || !presign.mediaId) throw new Error(presign.error ?? "Could not start the upload.");

  if (presign.direct && presign.uploadUrl) {
    const put = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: presign.headers ?? { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) throw new Error("The storage bucket refused the upload. Try again.");
  } else {
    const body = new FormData();
    body.append("file", file);
    const response = await fetch(`/api/sites/${siteId}/media`, { method: "POST", body });
    const payload = (await response.json()) as { asset?: UploadedAsset; deduplicated?: boolean; error?: string };
    if (!response.ok || !payload.asset) throw new Error(payload.error ?? "Upload failed");
    return { ...payload.asset, deduplicated: payload.deduplicated };
  }

  const confirm = await fetch(`/api/sites/${siteId}/media/${presign.mediaId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checksum: await sha256Hex(file) }),
  });
  const confirmed = (await confirm.json()) as { asset?: UploadedAsset; error?: string };
  if (!confirm.ok || !confirmed.asset) throw new Error(confirmed.error ?? "The upload could not be verified.");
  return confirmed.asset;
}
