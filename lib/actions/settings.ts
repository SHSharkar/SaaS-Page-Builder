"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { platformSettings } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/session";
import { cacheClear, cacheStats } from "@/lib/cache";
import { runDueJobs } from "@/lib/queue";
import { sweepSessions } from "@/lib/auth/session";

export type ActionState = { ok: boolean; error?: string; message?: string };

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function updatePlatformSettingAction(input: { key: string; value: string }): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
    await ensureDb();
    const [existing] = await db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, input.key))
      .limit(1);
    if (!existing) throw new Error("Unknown setting.");

    let parsed: unknown = input.value;
    if (/^-?\d+$/.test(input.value.trim())) parsed = Number(input.value.trim());
    else if (input.value.trim() === "true" || input.value.trim() === "false") parsed = input.value.trim() === "true";

    await db
      .update(platformSettings)
      .set({ value: parsed, updatedBy: actor.user.id, updatedAt: new Date() })
      .where(eq(platformSettings.key, input.key));
    cacheClear();
    revalidatePath("/admin/settings");
    return { ok: true, message: `${input.key} saved. New requests read the new value immediately.` };
  } catch (error) {
    return failure(error);
  }
}

export async function runWorkerTickAction(): Promise<ActionState> {
  try {
    await requireRole("admin");
    const result = await runDueJobs(20);
    const swept = await sweepSessions();
    cacheClear();
    return {
      ok: true,
      message: `Processed ${result.processed} job${result.processed === 1 ? "" : "s"}${result.failed ? `, ${result.failed} failed` : ""} · swept ${swept} expired session${swept === 1 ? "" : "s"}.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function runCleanupAction(): Promise<ActionState> {
  try {
    const actor = await requireRole("admin");
    const { runDailyCleanup } = await import("@/lib/retention");
    const result = await runDailyCleanup(actor);
    cacheClear();
    revalidatePath("/admin/settings");
    const parts = [
      `${result.sessionsRemoved} sessions`,
      `${result.invitesExpired} invites`,
      `${result.versionsPruned} snapshots`,
      `${result.importJobsRemoved + result.importFilesRemoved + result.pendingMediaRemoved} files`,
      `${result.auditRowsRemoved} audit rows`,
      `${result.sitesPurged} sites`,
      `${result.domainsForgotten} hostnames`,
    ];
    return { ok: true, message: `Sweeper ran: ${parts.join(" · ")}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function clearCacheAction(): Promise<ActionState> {
  try {
    await requireRole("admin");
    cacheClear();
    const stats = cacheStats();
    return { ok: true, message: `Cache cleared. ${stats.keys} keys remain (${stats.hitRateNote}).` };
  } catch (error) {
    return failure(error);
  }
}
