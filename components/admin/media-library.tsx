"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteMediaAction,
  mediaUsageAction,
  updateMediaAltAction,
} from "@/lib/actions/media";
import { uploadSiteMedia } from "@/lib/media/upload-client";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { CopyInline, Notice, type ActionResult } from "@/components/admin/action";
import {
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
} from "@/lib/theme-classes";

type Asset = {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  altText: string;
  url: string;
  createdAt: string;
};

export function MediaLibrary({
  siteId,
  assets,
  canUpload,
  canDelete,
  maxBytes,
}: {
  siteId: string;
  assets: Asset[];
  canUpload: boolean;
  canDelete: boolean;
  maxBytes: number;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Asset | null>(assets[0] ?? null);
  const [altText, setAltText] = useState<string>(assets[0]?.altText ?? "");
  const [usage, setUsage] = useState<string[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Asset | null>(null);

  const pick = (asset: Asset) => {
    setSelected(asset);
    setAltText(asset.altText);
    setUsage(null);
    startTransition(async () => {
      const refs = await mediaUsageAction({ siteId, mediaId: asset.id });
      setUsage(refs.references ?? []);
    });
  };

  return (
    <div className="space-y-6">
      {canUpload ? (
        <form
          className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const file = form.get("file");
            if (!(file instanceof File) || file.size === 0) {
              setState({ ok: false, error: "Choose an image file first." });
              return;
            }
            const alt = String(form.get("altText") ?? "");
            startTransition(async () => {
              try {
                const uploaded = await uploadSiteMedia(siteId, file);
                if (alt.trim()) {
                  await updateMediaAltAction({
                    siteId,
                    mediaId: uploaded.id,
                    altText: alt.trim(),
                  });
                }
                setState({
                  ok: true,
                  message: uploaded.deduplicated
                    ? "That image was already in the library, so the existing copy is used."
                    : `Uploaded ${file.name}.`,
                });
                if (fileRef.current) fileRef.current.value = "";
                router.refresh();
              } catch (err) {
                setState({
                  ok: false,
                  error: err instanceof Error ? err.message : "Upload failed.",
                });
              }
            });
          }}
        >
          <div className="min-w-52 flex-1">
            <label className={adminLabelClass} htmlFor="media-file">
              Image file
            </label>
            <input
              ref={fileRef}
              id="media-file"
              name="file"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              PNG, JPEG, WebP, GIF, or AVIF up to {Math.round(maxBytes / (1024 * 1024))} MB.
              Duplicate files reuse the stored object automatically.
            </p>
          </div>
          <div className="min-w-52 flex-1">
            <label className={adminLabelClass} htmlFor="media-alt">
              Alt text (optional)
            </label>
            <input
              id="media-alt"
              name="altText"
              className={adminInputClass}
              placeholder="Short description for screen readers"
            />
          </div>
          <button
            type="submit"
            className={adminButtonVariants({ tone: "primary" })}
            disabled={pending}
          >
            {pending ? "Uploading..." : "Upload"}
          </button>
        </form>
      ) : null}

      <Notice state={state} />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:col-span-8 xl:grid-cols-4">
          {assets.map((asset) => {
            const active = selected?.id === asset.id;
            return (
              <button
                key={asset.id}
                type="button"
                onClick={() => pick(asset)}
                className={`group overflow-hidden rounded-xl border bg-white text-left transition ${
                  active
                    ? "border-slate-950 ring-2 ring-slate-950/15"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="grid aspect-[4/3] place-items-center overflow-hidden bg-slate-100 p-2">
                  <img
                    src={asset.url}
                    alt={asset.altText}
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="p-2.5">
                  <p className="break-words text-xs font-medium text-slate-900">
                    {asset.originalName}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    {(asset.byteSize / 1024).toFixed(1)} KB
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <aside className="lg:col-span-4">
          {selected ? (
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4">
              <div className="grid aspect-[16/10] place-items-center overflow-hidden rounded-lg bg-slate-100 p-3">
                <img
                  src={selected.url}
                  alt={selected.altText}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="space-y-1 text-xs">
                <p className="break-words font-semibold text-slate-950">
                  {selected.originalName}
                </p>
                <p className="text-slate-500">
                  {selected.mimeType} | {(selected.byteSize / 1024).toFixed(1)} KB
                  {selected.width && selected.height
                    ? ` | ${selected.width}x${selected.height}`
                    : ""}
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">
                    {selected.url}
                  </code>
                  <CopyInline value={selected.url} />
                </div>
                <div className="flex items-center gap-2">
                  <code className="break-all rounded bg-slate-100 px-1.5 py-0.5 text-[11px]">
                    id: {selected.id}
                  </code>
                  <CopyInline value={selected.id} label="Copy ID" />
                </div>
              </div>

              {canUpload ? (
                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <label className={adminLabelClass} htmlFor="alt-edit">
                    Alt text
                  </label>
                  <input
                    id="alt-edit"
                    className={adminInputClass}
                    value={altText}
                    onChange={(event) => setAltText(event.target.value)}
                  />
                  <button
                    type="button"
                    className={adminButtonVariants({ tone: "secondary", size: "sm" })}
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const res = await updateMediaAltAction({
                          siteId,
                          mediaId: selected.id,
                          altText,
                        });
                        setState(res);
                        if (res.ok) router.refresh();
                      })
                    }
                  >
                    Save alt text
                  </button>
                </div>
              ) : null}

              <div className="space-y-1.5 border-t border-slate-200 pt-3 text-xs">
                <p className="font-semibold text-slate-700">Where this file is used</p>
                {usage === null ? (
                  <p className="text-slate-400">Select an asset to inspect references.</p>
                ) : usage.length === 0 ? (
                  <p className="text-slate-500">Not referenced by any page or global content.</p>
                ) : (
                  <ul className="list-inside list-disc space-y-0.5 text-slate-600">
                    {usage.map((place) => (
                      <li key={place}>{place}</li>
                    ))}
                  </ul>
                )}
              </div>

              {canDelete ? (
                <div className="border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    disabled={pending}
                    className={adminButtonVariants({ tone: "danger", size: "sm" })}
                    onClick={() => setConfirmDelete(selected)}
                  >
                    Delete file
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-xs text-slate-500">
              Select a file to inspect its usage and alt text.
            </div>
          )}
        </aside>
      </div>

      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete media asset"
        description={
          confirmDelete
            ? `Delete "${confirmDelete.originalName}"? If any page or global content references this asset, deletion will be blocked.`
            : ""
        }
        confirmLabel="Delete file"
        tone="danger"
        pending={pending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          const target = confirmDelete;
          setConfirmDelete(null);
          startTransition(async () => {
            const res = await deleteMediaAction({
              siteId,
              mediaId: target.id,
            });
            setState(res);
            if (res.ok) {
              setSelected(null);
              router.refresh();
            }
          });
        }}
      />
    </div>
  );
}
