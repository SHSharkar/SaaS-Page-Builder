-- Lifecycle additions: audit actions for restore, purge, media confirmation
-- and the daily sweeper. Enum values are additive, so existing rows are safe.
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'site_restored';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'site_purged';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'page_restored';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'media_confirmed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'cleanup_ran';
