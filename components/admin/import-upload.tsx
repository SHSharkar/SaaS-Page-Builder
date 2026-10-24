"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadImportAction } from "@/lib/actions/imports";
import type { ActionResult } from "./action";
import { Notice } from "./action";

export function ImportUpload({ siteId }: { siteId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [html, setHtml] = useState("");
  const [filename, setFilename] = useState("");
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  async function readFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setState({ ok: false, error: "Import files are capped at 5 MB." });
      return;
    }
    setFilename(file.name);
    setHtml(await file.text());
    setState({ ok: true, message: `${file.name} loaded — review the mapping before applying.` });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="import-file">
            HTML file
          </label>
          <input
            ref={fileRef}
            id="import-file"
            type="file"
            accept="text/html,.html,.htm"
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-line file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-700"
            onChange={(event) => void readFile(event.target.files?.[0])}
          />
          <p className="mt-1 text-[11px] text-slate-400">One file · 5 MB · the bytes are inspected, not the name.</p>
        </div>
        <div>
          <label className="label" htmlFor="import-name">
            Label
          </label>
          <input
            id="import-name"
            className="input"
            value={filename}
            onChange={(event) => setFilename(event.target.value)}
            placeholder="spring-campaign.html"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="import-html">
          …or paste the markup
        </label>
        <textarea
          id="import-html"
          className="textarea font-mono !text-[11px]"
          rows={6}
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          placeholder="<section>…</section>"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn-admin btn-admin-primary"
          disabled={pending || html.trim().length < 20}
          onClick={() =>
            startTransition(async () => {
              const result = await uploadImportAction({ siteId, filename, html });
              setState(result);
              if (result.ok && result.jobId) router.push(`/admin/sites/${siteId}/imports/${result.jobId}`);
            })
          }
        >
          {pending ? "Mapping…" : "Analyse and review"}
        </button>
        <p className="text-[11px] text-slate-500">
          Nothing is created yet — the analysis produces a proposal a human must approve.
        </p>
      </div>

      <Notice state={state} />
    </div>
  );
}
