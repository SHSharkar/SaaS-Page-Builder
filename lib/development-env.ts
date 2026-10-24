export const DEVELOPMENT_ENV_DEFAULTS: Readonly<Record<string, string>> = {
  DATABASE_URL: "postgresql://claude_dev@127.0.0.1:5432/saas_page_builder_dev",
  REDIS_URL: "redis://127.0.0.1:6379/0",
  BETTER_AUTH_SECRET:
    "1111111111111111111111111111111111111111111111111111111111111111",
  BETTER_AUTH_URL: "http://localhost:3000",
  PRIMARY_DOMAIN: "localhost:3000",
  PLATFORM_DOMAIN: "sites.localhost",
  ADMIN_PATH: "/admin",
  SETTINGS_ENCRYPTION_KEY:
    "2222222222222222222222222222222222222222222222222222222222222222",
  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:
    "3333333333333333333333333333333333333333333333333333333333333333",
  GUEST_LOOKUP_KEY:
    "4444444444444444444444444444444444444444444444444444444444444444",
  GUEST_CONTACT_KEY:
    "5555555555555555555555555555555555555555555555555555555555555555",
  BACKUP_ENCRYPTION_KEY:
    "6666666666666666666666666666666666666666666666666666666666666666",
  INTERNAL_TLS_CHECK_TOKEN:
    "7777777777777777777777777777777777777777777777777777777777777777",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_USER: "dev",
  SMTP_PASS: "dev",
  SMTP_FROM: "SaaS Page Builder <noreply@localhost>",
  R2_UPLOAD_ENDPOINT: "http://127.0.0.1:9000",
  R2_UPLOAD_BUCKET: "spb-uploads-dev",
  R2_UPLOAD_ACCESS_KEY_ID: "dev-upload-key",
  R2_UPLOAD_SECRET_ACCESS_KEY: "dev-upload-secret",
  R2_UPLOAD_PUBLIC_URL: "http://localhost:3000/api/files",
  R2_BACKUP_ENDPOINT: "http://127.0.0.1:9000",
  R2_BACKUP_BUCKET: "spb-backups-dev",
  R2_BACKUP_ACCESS_KEY_ID: "dev-backup-key",
  R2_BACKUP_SECRET_ACCESS_KEY: "dev-backup-secret",
  STRIPE_SECRET_KEY: "stripe-dev-placeholder",
  STRIPE_WEBHOOK_SECRET: "webhook-dev-placeholder",
};

export function applyDevelopmentEnvDefaults(
  target: Record<string, string | undefined> = process.env,
): void {
  if (target.NODE_ENV === "production") {
    return;
  }
  for (const [key, fallback] of Object.entries(DEVELOPMENT_ENV_DEFAULTS)) {
    const existing = target[key];
    if (!existing || existing.trim().length === 0) {
      target[key] = fallback;
    }
  }
}
