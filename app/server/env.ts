import "server-only";
import { z } from "zod";
import { applyDevelopmentEnvDefaults } from "@/lib/development-env";

applyDevelopmentEnvDefaults();

const hex64 = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "Expected a 64-character hex key");

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  PRIMARY_DOMAIN: z.string().min(1),
  PLATFORM_DOMAIN: z.string().min(1),
  ADMIN_PATH: z.string().startsWith("/").min(2),
  SETTINGS_ENCRYPTION_KEY: hex64,
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: hex64,
  GUEST_LOOKUP_KEY: hex64,
  GUEST_CONTACT_KEY: hex64,
  BACKUP_ENCRYPTION_KEY: hex64,
  INTERNAL_TLS_CHECK_TOKEN: z.string().min(16),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(3),
  R2_UPLOAD_ENDPOINT: z.string().url(),
  R2_UPLOAD_BUCKET: z.string().min(1),
  R2_UPLOAD_ACCESS_KEY_ID: z.string().min(1),
  R2_UPLOAD_SECRET_ACCESS_KEY: z.string().min(1),
  R2_UPLOAD_PUBLIC_URL: z.string().url(),
  R2_BACKUP_ENDPOINT: z.string().url(),
  R2_BACKUP_BUCKET: z.string().min(1),
  R2_BACKUP_ACCESS_KEY_ID: z.string().min(1),
  R2_BACKUP_SECRET_ACCESS_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(8),
  STRIPE_WEBHOOK_SECRET: z.string().min(8),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
  BOOTSTRAP_ADMIN_NAME: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function parseServerEnv(
  raw: Readonly<Record<string, string | undefined>> = process.env,
): ServerEnv {
  const cleaned: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(raw)) {
    cleaned[k] = v && v.trim().length > 0 ? v.trim() : undefined;
  }
  return serverEnvSchema.parse(cleaned);
}

export function getEnv(): ServerEnv {
  if (!cachedEnv) {
    cachedEnv = parseServerEnv(process.env);
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = null;
}
