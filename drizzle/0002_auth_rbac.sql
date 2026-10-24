-- Move identity onto Better Auth and authorization onto database-backed roles.
--
-- Identity: Better Auth owns user, account, session, verification and
-- two_factor. The password moves from user.password_hash into a credential
-- account row, which is the shape the library reads.
-- Authorization: role, permission, role_permission and user_role replace the
-- user_role enum, so a role can be created and shaped at run time.
--
-- The old enum values are copied into temporary tables first: the columns that
-- hold them have to go before a table can take the name "user_role".

-- Stash the enum values in ordinary columns so they survive the column drop.
ALTER TABLE "user" ADD COLUMN "legacy_role" text;--> statement-breakpoint
UPDATE "user" SET "legacy_role" = "role"::text;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD COLUMN "legacy_role" text;--> statement-breakpoint
UPDATE "staff_invite" SET "legacy_role" = "role"::text;--> statement-breakpoint

CREATE TABLE "role" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "rank" integer DEFAULT 0 NOT NULL,
  "is_system" boolean DEFAULT false NOT NULL,
  "permissions_seeded" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "permission" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" text NOT NULL,
  "group_key" text NOT NULL,
  "label" text NOT NULL,
  "description" text DEFAULT '' NOT NULL,
  "dangerous" boolean DEFAULT false NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "role_permission" (
  "role_id" uuid NOT NULL,
  "permission_id" uuid NOT NULL,
  "granted_at" timestamp with time zone DEFAULT now() NOT NULL,
  "granted_by" uuid,
  CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);--> statement-breakpoint

ALTER TABLE "user" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE TABLE "account" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" uuid NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope" text,
  "password" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "verification" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "two_factor" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "secret" text NOT NULL,
  "backup_codes" text NOT NULL,
  "verified" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Every existing password becomes a credential account for its user.
INSERT INTO "account" ("account_id", "provider_id", "user_id", "password")
SELECT "id"::text, 'credential', "id", "password_hash" FROM "user";--> statement-breakpoint

-- The three system roles the enum used to imply.
INSERT INTO "role" ("key", "name", "description", "rank", "is_system")
VALUES
  ('admin', 'Administrator', 'Everything, including people, roles, sites and platform settings.', 100, true),
  ('editor', 'Editor', 'Builds, imports and publishes pages and global content.', 50, true),
  ('viewer', 'Viewer', 'Reads pages, history, media and the audit log. Changes nothing.', 10, true);--> statement-breakpoint

-- The enum is only reachable through these two columns now; drop them, then the
-- type, then create the join table that takes its name.
ALTER TABLE "staff_invite" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "password_hash";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "two_factor_secret";--> statement-breakpoint
DROP TYPE "user_role";--> statement-breakpoint

CREATE TABLE "user_role" (
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
  "assigned_by" uuid,
  CONSTRAINT "user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);--> statement-breakpoint

INSERT INTO "user_role" ("user_id", "role_id")
SELECT u."id", r."id" FROM "user" u JOIN "role" r ON r."key" = u."legacy_role";--> statement-breakpoint

ALTER TABLE "staff_invite" ADD COLUMN "role_id" uuid;--> statement-breakpoint
UPDATE "staff_invite" i SET "role_id" = r."id" FROM "role" r WHERE r."key" = i."legacy_role";--> statement-breakpoint
ALTER TABLE "staff_invite" ALTER COLUMN "role_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "staff_invite" DROP COLUMN "legacy_role";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN "legacy_role";--> statement-breakpoint

-- The old session table was ours; Better Auth's is the one that survives.
DROP TABLE "session";--> statement-breakpoint

CREATE TABLE "session" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token" text NOT NULL,
  "user_id" uuid NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "step_up_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX "role_key_idx" ON "role" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "permission_key_idx" ON "permission" USING btree ("key");--> statement-breakpoint
CREATE INDEX "user_role_role_idx" ON "user_role" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_status_idx" ON "user" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'account_created';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'account_updated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'account_suspended';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'account_reactivated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'password_changed';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'password_reset_requested';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'roles_assigned';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'role_created';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'role_updated';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'role_deleted';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'session_revoked';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'two_factor_enabled';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'two_factor_disabled';
