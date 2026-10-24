"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMediaAction, updateAltTextAction } from "@/lib/actions/media";
import type { ActionResult } from "./action";
import { Notice } from "./action";

type Asset = {
  id: string;
  publicUrl: string;
  altText: string | null;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  createdAt: string;
};

function kb(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function MediaLibrary({ siteId, assets }: { siteId: string; assets: Asset[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<ActionResult | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [alt, setAlt] = useState("");
  const [pending, startTransition] = useTransition();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setState(null);
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`/api/sites/${siteId}/media`, { method: "POST", body });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; deduplicated?: boolean };
      if (!response.ok) {
        setState({ ok: false, error: payload.error ?? `Upload failed (${response.status})` });
      } else {
        setState({
          ok: true,
          message: payload.deduplicated
            ? `${file.name} was already in the library — the existing copy is reused.`
            : `${file.name} uploaded.`,
        });
      }
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white/60 px-4 py-4">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          multiple
          className="block text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
          onChange={(event) => void upload(event.target.files)}
        />
        <p className="text-[11px] text-slate-500">
          {uploading ? "Uploading…" : "PNG, JPEG, WebP, GIF or SVG · 5 MB per file · duplicates are deduplicated by hash"}
        </p>
      </div>
      <Notice state={state} />

      {assets.length === 0 ? (
        <p className="rounded-xl border border-line bg-white px-5 py-10 text-center text-sm text-slate-500">
          No images yet. Upload the first one above.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id} className="panel overflow-hidden">
              <div className="relative aspect-[4/3] bg-paper">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset.publicUrl} alt={asset.altText ?? ""} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2 p-3">
                {editing === asset.id ? (
                  <div className="flex gap-1.5">
                    <input
                      className="input !py-1 !text-xs"
                      value={alt}
                      onChange={(event) => setAlt(event.target.value)}
                      placeholder="Describe the image"
                      autoFocus
                    />
                    <button
                      type="button"
                      className="btn-admin btn-admin-primary !px-2 !py-1 !text-[11px]"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const result = await updateAltTextAction({ siteId, mediaId: asset.id, altText: alt });
                          setState(result);
                          setEditing(null);
                          router.refresh();
                        })
                      }
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="block w-full truncate text-left text-[12px] font-medium text-ink-900 hover:underline"
                    title="Edit alt text"
                    onClick={() => {
                      setEditing(asset.id);
                      setAlt(asset.altText ?? "");
                    }}
                  >
                    {asset.altText || "Add alt text"}
                  </button>
                )}
                <p className="text-[10px] text-slate-400">
                  {asset.width && asset.height ? `${asset.width}×${asset.height} · ` : ""}
                  {kb(asset.sizeBytes)} · {asset.mimeType.replace("image/", "").toUpperCase()}
                </p>
                <div className="flex items-center gap-1.5">
                  <a
                    href={asset.publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-line bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-paper"
                  >
                    Open
                  </a>
                  <button
                    type="button"
                    className="rounded-md border border-line bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-paper"
                    onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${asset.publicUrl}`)}
                  >
                    Copy URL
                  </button>
                  <button
                    type="button"
                    className="ml-auto rounded-md border border-red-200 bg-white px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-50"
                    disabled={pending}
                    onClick={() => {
                      if (!window.confirm("Delete this image? Deletion is refused while any page still references it.")) return;
                      startTransition(async () => {
                        const result = await deleteMediaAction({ siteId, mediaId: asset.id });
                        setState(result);
                        router.refresh();
                      });
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
