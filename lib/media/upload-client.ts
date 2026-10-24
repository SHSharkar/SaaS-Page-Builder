export type UploadedAsset = {
  id: string;
  url: string;
  alt: string;
  width?: number | null;
  height?: number | null;
};

type PresignPayload =
  | {
      mode: "deduplicated";
      asset: {
        id: string;
        publicUrl: string;
        altText: string;
        width?: number | null;
        height?: number | null;
      };
    }
  | {
      mode: "presigned";
      mediaId: string;
      uploadUrl: string;
      headers: Record<string, string>;
      confirmUrl: string;
    }
  | {
      mode: "direct";
      mediaId: string;
      uploadUrl: string;
    }
  | { detail?: string; title?: string; error?: string };

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

function readProblemMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const obj = payload as { detail?: string; error?: string; title?: string };
  return obj.detail ?? obj.error ?? obj.title ?? fallback;
}

export async function uploadFile(
  siteId: string,
  file: File,
): Promise<UploadedAsset & { deduplicated?: boolean }> {
  const checksum = await sha256Hex(file);
  const start = await fetch(`/api/sites/${siteId}/media/presign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      checksum,
    }),
  });
  const presign = (await start.json().catch(() => ({}))) as PresignPayload;
  if (!start.ok || !("mode" in presign)) {
    throw new Error(readProblemMessage(presign, "Could not start the upload."));
  }

  if (presign.mode === "deduplicated") {
    return {
      id: presign.asset.id,
      url: presign.asset.publicUrl,
      alt: presign.asset.altText ?? "",
      width: presign.asset.width,
      height: presign.asset.height,
      deduplicated: true,
    };
  }

  if (presign.mode === "presigned") {
    const put = await fetch(presign.uploadUrl, {
      method: "PUT",
      headers: presign.headers,
      body: file,
    });
    if (!put.ok) {
      throw new Error("The object storage bucket refused the upload. Try again.");
    }
    const confirm = await fetch(presign.confirmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checksum }),
    });
    const confirmed = (await confirm.json().catch(() => ({}))) as {
      asset?: UploadedAsset;
      deduplicated?: boolean;
      detail?: string;
    };
    if (!confirm.ok || !confirmed.asset) {
      throw new Error(readProblemMessage(confirmed, "The upload could not be verified."));
    }
    return { ...confirmed.asset, deduplicated: confirmed.deduplicated };
  }

  const body = new FormData();
  body.append("file", file);
  const response = await fetch(presign.uploadUrl, { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as {
    asset?: UploadedAsset;
    deduplicated?: boolean;
    detail?: string;
  };
  if (!response.ok || !payload.asset) {
    throw new Error(readProblemMessage(payload, "Upload failed."));
  }
  return { ...payload.asset, deduplicated: payload.deduplicated };
}

export const uploadSiteMedia = uploadFile;

