"use server";

import { revalidatePath } from "next/cache";
import { requirePermission, requireStepUp, sweepSessions } from "@/lib/auth/session";
import { cacheClear, cacheStats } from "@/lib/cache";
import { revealSettingSecret, updateSetting } from "@/lib/settings";
import { runDailySweep, runOrphanMediaSweep } from "@/lib/sweeper";
import { recordAudit } from "@/lib/audit";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  secretValue?: string | null;
};

function failure(error: unknown): ActionState {
  return { ok: false, error: error instanceof Error ? error.message : String(error) };
}

export async function updatePlatformSettingAction(input: {
  key: string;
  value: string;
  isSecret?: boolean;
}): Promise<ActionState> {
  try {
    const actor = await requirePermission("settings.manage");
    if (input.isSecret) {
      await requireStepUp(actor);
      await updateSetting(input.key, input.value, actor, true);
    } else {
      const trimmed = input.value.trim();
      let parsed: unknown = input.value;
      if (/^-?\d+$/.test(trimmed)) parsed = Number(trimmed);
      else if (trimmed === "true" || trimmed === "false") parsed = trimmed === "true";
      await updateSetting(input.key, parsed, actor, false);
    }
    revalidatePath("/admin/settings");
    return {
      ok: true,
      message: `${input.key} saved. New requests read the updated value immediately.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function revealPlatformSecretAction(input: { key: string }): Promise<ActionState> {
  try {
    const actor = await requirePermission("settings.manage");
    await requireStepUp(actor);
    const value = await revealSettingSecret(input.key, actor);
    return {
      ok: true,
      secretValue: value ?? "",
      message: value ? `Revealed ${input.key} for this session.` : `${input.key} is currently empty.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function runWorkerTickAction(): Promise<ActionState> {
  try {
    const actor = await requirePermission("ops.run");
    const [sweptSessions, sweptMedia] = await Promise.all([
      sweepSessions(),
      runOrphanMediaSweep(),
    ]);
    await cacheClear();
    await recordAudit({
      actor,
      action: "ops_worker_tick",
      targetType: "platform",
      summary: `Ran manual maintenance tick (${sweptSessions} sessions, ${sweptMedia.pendingRemoved} stale uploads)`,
    });
    revalidatePath("/admin/settings");
    return {
      ok: true,
      message: `Maintenance tick complete: ${sweptSessions} expired session(s) and ${sweptMedia.pendingRemoved} stale upload(s) cleared.`,
    };
  } catch (error) {
    return failure(error);
  }
}

export async function runCleanupAction(): Promise<ActionState> {
  try {
    const actor = await requirePermission("ops.run");
    const result = await runDailySweep(actor);
    await cacheClear();
    revalidatePath("/admin/settings");
    const parts = [
      `${result.sessionsRemoved} sessions`,
      `${result.invitesExpired + result.invitesRemoved} invites`,
      `${result.versionsPruned} versions`,
      `${result.pendingMediaRemoved + result.importJobsRemoved} import/upload items`,
      `${result.auditRemoved} audit rows`,
      `${result.sitesPurged} sites`,
    ];
    return { ok: true, message: `Sweeper finished: ${parts.join(", ")}.` };
  } catch (error) {
    return failure(error);
  }
}

export async function clearCacheAction(): Promise<ActionState> {
  try {
    await requirePermission("ops.run");
    await cacheClear();
    const stats = await cacheStats();
    return {
      ok: true,
      message: `Response cache cleared (${stats.keys} tracked keys remaining on ${stats.backend}).`,
    };
  } catch (error) {
    return failure(error);
  }
}
