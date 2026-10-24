CREATE TYPE "public"."audit_action" AS ENUM('signed_in', 'signed_out', 'sign_in_failed', 'invite_created', 'invite_revoked', 'invite_accepted', 'invite_expired', 'user_role_changed', 'user_disabled', 'user_enabled', 'site_created', 'site_updated', 'site_suspended', 'site_deleted', 'page_created', 'page_updated', 'page_deleted', 'page_published', 'page_unpublished', 'page_archived', 'page_rolled_back', 'page_scheduled', 'homepage_set', 'globals_published', 'globals_updated', 'domain_added', 'domain_verified', 'domain_failed', 'domain_removed', 'media_uploaded', 'media_deleted', 'media_delete_blocked', 'template_created', 'template_applied', 'import_uploaded', 'import_mapped', 'import_applied', 'import_discarded', 'import_failed', 'settings_changed', 'step_up_granted');--> statement-breakpoint
CREATE TYPE "public"."certificate_issuer" AS ENUM('lets_encrypt', 'zero_ssl', 'none');--> statement-breakpoint
CREATE TYPE "public"."certificate_state" AS ENUM('none', 'requested', 'issued', 'failed');--> statement-breakpoint
CREATE TYPE "public"."component_group" AS ENUM('site-frame', 'conversion', 'money', 'content', 'utility');--> statement-breakpoint
CREATE TYPE "public"."component_status" AS ENUM('active', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."domain_kind" AS ENUM('platform_subdomain', 'custom');--> statement-breakpoint
CREATE TYPE "public"."domain_status" AS ENUM('pending', 'verifying', 'active', 'failed', 'removed');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('uploaded', 'parsing', 'mapped', 'in_review', 'applied', 'discarded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'done', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'file', 'import_reference');--> statement-breakpoint
CREATE TYPE "public"."media_status" AS ENUM('pending', 'ready', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."site_content_kind" AS ENUM('navigation', 'footer', 'defaults');--> statement-breakpoint
CREATE TYPE "public"."site_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."template_scope" AS ENUM('platform', 'staff');--> statement-breakpoint
CREATE TYPE "public"."template_status" AS ENUM('draft', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."version_source" AS ENUM('manual', 'template', 'import', 'generated', 'rollback');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid,
	"actor_user_id" uuid,
	"actor_role_snapshot" text,
	"action" "audit_action" NOT NULL,
	"target_type" text,
	"target_id" text,
	"summary" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"display_name" text NOT NULL,
	"group" "component_group" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"status" "component_status" DEFAULT 'active' NOT NULL,
	"preview_media_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domain" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"kind" "domain_kind" DEFAULT 'custom' NOT NULL,
	"status" "domain_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"verification_token" text,
	"verified_at" timestamp with time zone,
	"certificate_issuer" "certificate_issuer" DEFAULT 'lets_encrypt' NOT NULL,
	"certificate_state" "certificate_state" DEFAULT 'none' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"removed_at" timestamp with time zone,
	"requested_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"status" "import_status" DEFAULT 'uploaded' NOT NULL,
	"failure_reason" text,
	"file_media_id" uuid,
	"source_name" text NOT NULL,
	"mapping_result" jsonb,
	"review_result" jsonb,
	"produced_page_id" uuid,
	"llm_usage" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"dedupe_key" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "media_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" "media_kind" DEFAULT 'image' NOT NULL,
	"storage_key" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" text NOT NULL,
	"original_url" text,
	"alt_text" text,
	"status" "media_status" DEFAULT 'ready' NOT NULL,
	"deleted_at" timestamp with time zone,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"document" jsonb NOT NULL,
	"document_schema_version" integer DEFAULT 1 NOT NULL,
	"source" "version_source" DEFAULT 'manual' NOT NULL,
	"seo" jsonb NOT NULL,
	"title" text NOT NULL,
	"published_by" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"status" "page_status" DEFAULT 'draft' NOT NULL,
	"is_homepage" boolean DEFAULT false NOT NULL,
	"current_published_version_id" uuid,
	"draft_document" jsonb NOT NULL,
	"draft_updated_by" uuid,
	"lock_version" integer DEFAULT 0 NOT NULL,
	"seo" jsonb NOT NULL,
	"scheduled_publish_at" timestamp with time zone,
	"scheduled_unpublish_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"is_secret" boolean DEFAULT false NOT NULL,
	"encrypted_value" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"step_up_until" timestamp with time zone,
	"pending_two_factor" boolean DEFAULT false NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" "site_content_kind" NOT NULL,
	"lock_version" integer DEFAULT 0 NOT NULL,
	"draft_document" jsonb,
	"published_document" jsonb,
	"published_at" timestamp with time zone,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "site_status" DEFAULT 'active' NOT NULL,
	"theme" jsonb NOT NULL,
	"default_locale" text DEFAULT 'en' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"token_hash" text NOT NULL,
	"status" "invite_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"invited_by" uuid,
	"accepted_by" uuid,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "template_scope" DEFAULT 'platform' NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'Campaign' NOT NULL,
	"document" jsonb NOT NULL,
	"placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preview_media_id" uuid,
	"accent" text DEFAULT '#c8a24a' NOT NULL,
	"status" "template_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"password_hash" text,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"two_factor_secret" text,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component" ADD CONSTRAINT "component_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain" ADD CONSTRAINT "domain_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_file_media_id_media_asset_id_fk" FOREIGN KEY ("file_media_id") REFERENCES "public"."media_asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_produced_page_id_page_id_fk" FOREIGN KEY ("produced_page_id") REFERENCES "public"."page"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_version" ADD CONSTRAINT "page_version_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_version" ADD CONSTRAINT "page_version_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_draft_updated_by_user_id_fk" FOREIGN KEY ("draft_updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_setting" ADD CONSTRAINT "platform_setting_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_site_id_site_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."site"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_content" ADD CONSTRAINT "site_content_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_invite" ADD CONSTRAINT "staff_invite_accepted_by_user_id_fk" FOREIGN KEY ("accepted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template" ADD CONSTRAINT "template_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_site_created_idx" ON "audit_log" USING btree ("site_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "component_alias_idx" ON "component" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "component_group_idx" ON "component" USING btree ("group");--> statement-breakpoint
CREATE UNIQUE INDEX "domain_live_hostname_idx" ON "domain" USING btree ("hostname") WHERE removed_at is null;--> statement-breakpoint
CREATE INDEX "domain_site_idx" ON "domain" USING btree ("site_id");--> statement-breakpoint
CREATE INDEX "domain_status_idx" ON "domain" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_site_status_idx" ON "import_job" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX "import_creator_idx" ON "import_job" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "job_poll_idx" ON "job" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_dedupe_idx" ON "job" USING btree ("dedupe_key") WHERE dedupe_key is not null and status in ('queued','running');--> statement-breakpoint
CREATE UNIQUE INDEX "media_site_checksum_idx" ON "media_asset" USING btree ("site_id","checksum") WHERE status = 'ready';--> statement-breakpoint
CREATE INDEX "media_site_status_idx" ON "media_asset" USING btree ("site_id","status");--> statement-breakpoint
CREATE INDEX "media_site_kind_idx" ON "media_asset" USING btree ("site_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "page_version_number_idx" ON "page_version" USING btree ("page_id","version_number");--> statement-breakpoint
CREATE INDEX "page_version_history_idx" ON "page_version" USING btree ("page_id","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "page_site_slug_idx" ON "page" USING btree ("site_id","slug") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "page_one_homepage_idx" ON "page" USING btree ("site_id") WHERE is_homepage = true and status = 'published' and deleted_at is null;--> statement-breakpoint
CREATE INDEX "page_list_idx" ON "page" USING btree ("site_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "page_schedule_idx" ON "page" USING btree ("scheduled_publish_at");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_hash_idx" ON "session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "site_content_site_kind_idx" ON "site_content" USING btree ("site_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "site_live_slug_idx" ON "site" USING btree ("slug") WHERE deleted_at is null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_invite_live_email_idx" ON "staff_invite" USING btree ("email") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "staff_invite_sweep_idx" ON "staff_invite" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "template_scope_status_idx" ON "template" USING btree ("scope","status");
--> statement-breakpoint
ALTER TABLE "page" ADD CONSTRAINT "page_current_published_version_id_fk" FOREIGN KEY ("current_published_version_id") REFERENCES "page_version"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
