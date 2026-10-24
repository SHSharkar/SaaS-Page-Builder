"use client";

import { useRef, useState } from "react";
import type { ResolvedMedia } from "@/lib/media/refs";
import { uploadFile } from "@/lib/media/upload-client";

export type EditableMedia = ResolvedMedia;

function fieldShell(label: string, hint: string | undefined, children: React.ReactNode) {
  return (
    <div className="puck-field">
      <span className="puck-field-label">{label}</span>
      {children}
      {hint ? <p className="puck-field-hint">{hint}</p> : null}
    </div>
  );
}

export function MediaField({
  label,
  hint,
  value,
  onChange,
  media,
  siteId,
  onUploaded,
  readOnly,
}: {
  label: string;
  hint?: string;
  value: { id: string; alt?: string } | null | undefined;
  onChange: (value: { id: string; alt?: string } | null) => void;
  media: EditableMedia[];
  siteId: string;
  onUploaded: (asset: EditableMedia) => void;
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = media.find((item) => item.id === value?.id);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const asset = await uploadFile(siteId, file);
      onUploaded(asset);
      onChange({ id: asset.id });
      setOpen(false);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return fieldShell(
    label,
    hint,
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-16 w-24 items-center justify-center overflow-hidden rounded-md border border-dashed border-slate-300 bg-white"
          onClick={() => setOpen((value) => !value)}
          disabled={readOnly}
          aria-label={selected ? `Change image: ${selected.alt ?? ""}` : "Choose an image"}
        >
          {selected?.url ? (
            <img src={selected.url} alt={selected.alt ?? ""} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-slate-400">Choose</span>
          )}
        </button>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="rounded border border-line bg-white px-2 py-1 text-[11px] font-medium text-slate-600"
            onClick={() => inputRef.current?.click()}
            disabled={readOnly || busy}
          >
            {busy ? "Uploading…" : "Upload"}
          </button>
          {value?.id ? (
            <button
              type="button"
              className="text-[11px] text-slate-400 underline"
              onClick={() => onChange(null)}
              disabled={readOnly}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
      {error ? <p className="mt-1 text-[11px] text-red-600">{error}</p> : null}
      {open ? (
        <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-line bg-white p-2">
          {media.length === 0 ? (
            <p className="px-1 py-3 text-[11px] text-slate-500">
              No images yet. Upload one to start the library.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {media.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`overflow-hidden rounded border ${
                    item.id === value?.id ? "border-ink-900 ring-1 ring-ink-900" : "border-line"
                  }`}
                  onClick={() => {
                    onChange({ id: item.id });
                    setOpen(false);
                  }}
                  title={item.alt}
                >
                  {}
                  <img src={item.url} alt={item.alt ?? ""} className="h-14 w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>,
  );
}

export function ToggleField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  return fieldShell(
    label,
    hint,
    <button
      type="button"
      role="switch"
      aria-checked={!!value}
      onClick={() => onChange(!value)}
      className={`flex h-6 w-11 items-center rounded-full px-0.5 transition ${
        value ? "bg-ink-900" : "bg-slate-300"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-white shadow transition ${value ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>,
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (value: string) => void;
}) {
  return fieldShell(
    label,
    undefined,
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#c8a24a"}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-10 cursor-pointer rounded border border-line bg-white p-0.5"
        aria-label={label}
      />
      <input
        type="text"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded border border-line px-2 py-1 text-[12px]"
        placeholder="#c8a24a"
      />
    </div>,
  );
}

export function LinkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: { label: string; href: string; style?: string } | undefined;
  onChange: (value: { label: string; href: string; style?: string }) => void;
}) {
  const current = value ?? { label: "", href: "#", style: "solid" };
  return fieldShell(
    label,
    undefined,
    <div className="space-y-1.5">
      <input
        className="w-full rounded border border-line px-2 py-1 text-[12px]"
        placeholder="Button label"
        value={current.label}
        onChange={(event) => onChange({ ...current, label: event.target.value })}
      />
      <input
        className="w-full rounded border border-line px-2 py-1 text-[12px]"
        placeholder="/join or https://…"
        value={current.href}
        onChange={(event) => onChange({ ...current, href: event.target.value })}
      />
      <select
        className="w-full rounded border border-line px-2 py-1 text-[12px]"
        value={current.style ?? "solid"}
        onChange={(event) => onChange({ ...current, style: event.target.value })}
      >
        <option value="solid">Solid</option>
        <option value="outline">Outline</option>
        <option value="ghost">Ghost</option>
        <option value="light">Light</option>
      </select>
    </div>,
  );
}

export function ListField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string[] | undefined;
  onChange: (value: string[]) => void;
}) {
  return fieldShell(
    label,
    hint ?? "One entry per line.",
    <textarea
      className="min-h-[70px] w-full rounded border border-line px-2 py-1 text-[12px]"
      value={(value ?? []).join("\n")}
      onChange={(event) =>
        onChange(
          event.target.value
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        )
      }
    />,
  );
}
