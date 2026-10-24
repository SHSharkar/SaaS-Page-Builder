import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, ensureDb } from "@/lib/db";
import { platformSettings, type PlatformSetting } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { invalidatePlatformConfig, remember } from "@/lib/cache";
import { NotFoundError } from "@/lib/errors";
import { recordAudit } from "@/lib/audit";
import type { Actor } from "@/lib/auth/session";

export interface PublicSettingView {
  key: string;
  value: string;
  description: string;
  isSecret: boolean;
  hasSecretValue: boolean;
  updatedAt: Date;
}

export const DEFAULT_PLATFORM_SETTINGS: ReadonlyArray<{
  key: string;
  value: unknown;
  description: string;
  isSecret?: boolean;
}> = [
  {
    key: "platform.base_domain",
    value: "pages.trofeo.local",
    description: "Base domain appended to built-in site subdomains.",
  },
  {
    key: "domain.verification_txt_prefix",
    value: "trofeo-verify=",
    description: "Prefix expected inside DNS TXT verification records.",
  },
  {
    key: "limits.imports_per_day",
    value: 20,
    description: "Maximum HTML imports per site per rolling day.",
  },
  {
    key: "limits.domains_per_site",
    value: 10,
    description: "Maximum active or pending hostnames attached to a single site.",
  },
  {
    key: "limits.publish_per_hour",
    value: 60,
    description: "Maximum publish operations per staff actor per hour.",
  },
  {
    key: "media.max_upload_mb",
    value: 10,
    description: "Maximum size in megabytes for uploaded media assets.",
  },
  {
    key: "limits.upload_max_bytes",
    value: 10 * 1024 * 1024,
    description: "Maximum upload payload in bytes enforced by media upload endpoints.",
  },
  {
    key: "limits.import_max_mb",
    value: 5,
    description: "Maximum HTML import document size in megabytes.",
  },
  {
    key: "importer.llm_adapter",
    value: "none",
    description: "Optional LLM classification adapter (`none` or `openai-compatible`).",
  },
  {
    key: "importer.llm_base_url",
    value: "",
    description: "OpenAI-compatible base URL when LLM classification is enabled.",
  },
  {
    key: "importer.llm_model",
    value: "gpt-4o-mini",
    description: "Model identifier sent to the OpenAI-compatible importer endpoint.",
  },
  {
    key: "importer.llm_api_key",
    value: "",
    description: "Encrypted API key for the optional importer LLM endpoint.",
    isSecret: true,
  },
  {
    key: "security.require_two_factor",
    value: false,
    description: "Require every staff member to enroll TOTP 2FA before using the workspace.",
  },
];

export async function ensureDefaultSettings(): Promise<void> {
  await ensureDb();
  for (const item of DEFAULT_PLATFORM_SETTINGS) {
    if (item.isSecret) {
      const strVal = String(item.value ?? "");
      await db
        .insert(platformSettings)
        .values({
          key: item.key,
          value: null,
          encryptedValue: strVal ? encryptSecret(strVal) : null,
          isSecret: true,
          description: item.description,
        })
        .onConflictDoNothing();
    } else {
      await db
        .insert(platformSettings)
        .values({
          key: item.key,
          value: item.value,
          encryptedValue: null,
          isSecret: false,
          description: item.description,
        })
        .onConflictDoNothing();
    }
  }
}

export const seedPlatformSettings = ensureDefaultSettings;

export async function listSettingsForAdmin(): Promise<PublicSettingView[]> {
  await ensureDefaultSettings();
  const rows = await db.select().from(platformSettings).orderBy(asc(platformSettings.key));
  return rows.map((row) => ({
    key: row.key,
    value: row.isSecret
      ? ""
      : row.value === undefined || row.value === null
        ? ""
        : typeof row.value === "string"
          ? row.value
          : JSON.stringify(row.value),
    description: row.description,
    isSecret: row.isSecret,
    hasSecretValue: Boolean(row.isSecret && row.encryptedValue),
    updatedAt: row.updatedAt,
  }));
}

export const listPlatformSettings = listSettingsForAdmin;

async function loadSettingMap(): Promise<Record<string, unknown>> {
  return remember("cfg:platform:v1", 60, async () => {
    await ensureDb();
    const rows = await db.select().from(platformSettings);
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      if (!row.isSecret) {
        map[row.key] = row.value;
      }
    }
    return map;
  });
}

export async function getSettingNumber(key: string, fallback: number): Promise<number> {
  const map = await loadSettingMap();
  const raw = map[key];
  const parsed = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function getSettingBoolean(key: string, fallback: boolean): Promise<boolean> {
  const map = await loadSettingMap();
  const raw = map[key];
  if (typeof raw === "boolean") return raw;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return fallback;
}

export async function getSettingString(key: string, fallback: string): Promise<string> {
  const map = await loadSettingMap();
  const raw = map[key];
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : fallback;
}

export async function getSetting(key: "security.require_two_factor"): Promise<boolean>;
export async function getSetting(key: "media.max_upload_mb"): Promise<number>;
export async function getSetting(
  key: "platform.base_domain" | "domain.verification_txt_prefix",
): Promise<string>;
export async function getSetting(key: string): Promise<string | number | boolean> {
  if (key === "security.require_two_factor") {
    return getSettingBoolean(key, false);
  }
  if (key === "media.max_upload_mb") {
    return getSettingNumber(key, 10);
  }
  if (key === "platform.base_domain") {
    return getSettingString(key, "pages.trofeo.local");
  }
  if (key === "domain.verification_txt_prefix") {
    return getSettingString(key, "trofeo-verify=");
  }
  const map = await loadSettingMap();
  const val = map[key];
  if (typeof val === "number" || typeof val === "boolean" || typeof val === "string") {
    return val;
  }
  return "";
}

export async function getSecretSetting(key: string): Promise<string | null> {
  await ensureDb();
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  if (!row || !row.isSecret || !row.encryptedValue) return null;
  return decryptSecret(row.encryptedValue);
}

export const getSettingSecret = getSecretSetting;

export async function updateSetting(
  key: string,
  value: unknown,
  actor: Actor,
  isSecret = false,
): Promise<PlatformSetting> {
  await ensureDefaultSettings();
  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);

  const secretFlag = existing ? existing.isSecret : isSecret;
  let updated: PlatformSetting;

  if (secretFlag) {
    const trimmed = String(value ?? "").trim();
    const encrypted = trimmed.length > 0 ? encryptSecret(trimmed) : null;
    if (existing) {
      [updated] = await db
        .update(platformSettings)
        .set({
          value: null,
          encryptedValue: encrypted,
          isSecret: true,
          updatedBy: actor.user.id,
          updatedAt: new Date(),
        })
        .where(eq(platformSettings.key, key))
        .returning();
    } else {
      [updated] = await db
        .insert(platformSettings)
        .values({
          key,
          value: null,
          encryptedValue: encrypted,
          isSecret: true,
          updatedBy: actor.user.id,
        })
        .returning();
    }
  } else if (existing) {
    [updated] = await db
      .update(platformSettings)
      .set({
        value,
        encryptedValue: null,
        updatedBy: actor.user.id,
        updatedAt: new Date(),
      })
      .where(eq(platformSettings.key, key))
      .returning();
  } else {
    [updated] = await db
      .insert(platformSettings)
      .values({
        key,
        value,
        encryptedValue: null,
        isSecret: false,
        updatedBy: actor.user.id,
      })
      .returning();
  }

  await invalidatePlatformConfig();
  await recordAudit({
    actor,
    action: "setting_updated",
    targetType: "platform_setting",
    targetId: key,
    summary: secretFlag
      ? `Updated encrypted secret "${key}"`
      : `Updated platform setting "${key}"`,
    detail: { key, isSecret: secretFlag },
  });

  return updated;
}

export async function updatePlatformSetting(input: {
  key: string;
  rawValue: string;
  actor: Actor;
}): Promise<PlatformSetting> {
  const trimmed = input.rawValue.trim();
  let parsed: unknown = trimmed;
  if (/^-?\d+$/.test(trimmed)) parsed = Number(trimmed);
  else if (trimmed === "true" || trimmed === "false") parsed = trimmed === "true";
  return updateSetting(input.key, parsed, input.actor);
}

export async function revealSecretSetting(key: string, actor: Actor): Promise<string> {
  await ensureDefaultSettings();
  const [existing] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1);
  if (!existing || !existing.isSecret) {
    throw new NotFoundError("Secret setting not found.");
  }
  const plain = existing.encryptedValue ? decryptSecret(existing.encryptedValue) : "";
  await recordAudit({
    actor,
    action: "secret_revealed",
    targetType: "platform_setting",
    targetId: key,
    summary: `Revealed secret setting "${key}"`,
  });
  return plain;
}

export const revealSettingSecret = revealSecretSetting;
