-- The two-factor plugin keeps its own brute-force counters on two_factor and
-- refuses to run when they are missing. Additive, so an install that already
-- applied 0002 upgrades in place.
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "failed_verification_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;--> statement-breakpoint
