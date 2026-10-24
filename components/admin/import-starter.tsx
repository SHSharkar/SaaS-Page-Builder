"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startImportAction } from "@/lib/actions/imports";
import { Notice, type ActionResult } from "@/components/admin/action";
import {
  adminButtonVariants,
  adminInputClass,
  adminLabelClass,
  adminTextareaClass,
} from "@/lib/theme-classes";

const SAMPLE = `<section>
  <h1>Royal Trofeo - Autumn Launch</h1>
  <p>Claim a 200% welcome match up to EUR 600 plus 120 free spins on launch titles.</p>
  <a href="https://play.example.com/register">Claim the welcome bonus</a>
</section>
<section>
  <h2>Key figures</h2>
  <ul>
    <li>97.1% - Average verified RTP</li>
    <li>8 min - Median withdrawal speed</li>
    <li>2,800+ - Licensed slot and live tables</li>
  </ul>
</section>
<section>
  <h2>Featured tables</h2>
  <article><h3>Gold Vault Roulette</h3><p>Live studio, 97.3% RTP, EUR 0.50 minimum.</p></article>
  <article><h3>Starlight Cascade</h3><p>High-volatility cluster slot with 5,000x cap.</p></article>
  <article><h3>Velvet Blackjack</h3><p>Eight-deck shoe with side bets and instant seat.</p></article>
</section>
<script>window.__legacyTracker = true;</script>
<section>
  <h2>Frequently asked questions</h2>
  <details><summary>How fast are withdrawals?</summary><p>Verified accounts settle in under ten minutes.</p></details>
  <details><summary>What is the wagering requirement?</summary><p>35x bonus within 14 days. 18+ only.</p></details>
</section>`;

export function ImportStarter({
  siteId,
  canCreate,
}: {
  siteId: string;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("royal-trofeo-autumn.html");
  const [html, setHtml] = useState(SAMPLE);
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (!canCreate) return null;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const res = await startImportAction({ siteId, filename: name, html });
          setState(res);
          if (res.ok && res.jobId) {
            router.push(`/admin/sites/${siteId}/imports/${res.jobId}`);
          }
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={adminLabelClass} htmlFor="source-name">
            Source label or file name
          </label>
          <input
            id="source-name"
            className={adminInputClass}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className={adminLabelClass} htmlFor="html-upload">
            Or load an .html file from disk
          </label>
          <input
            id="html-upload"
            type="file"
            accept=".html,.htm,text/html"
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setName(file.name);
              setHtml(await file.text());
            }}
          />
        </div>
      </div>

      <div>
        <label className={adminLabelClass} htmlFor="html-source">
          HTML source
        </label>
        <textarea
          id="html-source"
          className={`${adminTextareaClass} font-mono text-xs`}
          rows={11}
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          required
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Scripts, iframes, and inline event handlers are stripped and listed on the review screen
          so nothing executes unexpectedly.
        </p>
      </div>

      <Notice state={state} />

      <button
        type="submit"
        className={adminButtonVariants({ tone: "primary" })}
        disabled={pending}
      >
        {pending ? "Analyzing HTML..." : "Analyze and open review"}
      </button>
    </form>
  );
}
