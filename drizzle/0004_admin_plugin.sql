ALTER TABLE "user" ADD COLUMN "role" text DEFAULT 'viewer' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "ban_expires" timestamp with time zone;--> statement-breakpoint
UPDATE "user" u SET "role" = r."key" FROM "user_role" ur JOIN "role" r ON r."id" = ur."role_id" WHERE ur."user_id" = u."id";--> statement-breakpoint
DROP TABLE "user_role";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "status";--> statement-breakpoint
DROP TYPE "user_status";--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
ALTER TABLE "session" ADD COLUMN "impersonated_by" text;--> statement-breakpoint
CREATE TABLE "passkey" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text,
  "public_key" text NOT NULL,
  "user_id" uuid NOT NULL,
  "credential_id" text NOT NULL,
  "counter" integer DEFAULT 0 NOT NULL,
  "device_type" text NOT NULL,
  "backed_up" boolean DEFAULT false NOT NULL,
  "transports" text,
  "aaguid" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "passkey_user_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "passkey_credential_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE TABLE "rate_limit" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "last_request" bigint DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE TABLE "staff_reset_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "url" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "staff_reset_link" ADD CONSTRAINT "staff_reset_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_reset_link_user_idx" ON "staff_reset_link" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_status_idx";--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'account_removed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'passkey_added';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'passkey_removed';
