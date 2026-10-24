CREATE TABLE "account_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_audit_logs_id_account_unique" UNIQUE("id","account_id")
);
--> statement-breakpoint
CREATE TABLE "account_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'editor' NOT NULL,
	"token_hash" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_invitations_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "account_invitations_role_check" CHECK ("account_invitations"."role" IN ('owner', 'admin', 'editor', 'viewer')),
	CONSTRAINT "account_invitations_status_check" CHECK ("account_invitations"."status" IN ('pending', 'accepted', 'revoked', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "account_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_members_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "account_members_role_check" CHECK ("account_members"."role" IN ('owner', 'admin', 'editor', 'viewer'))
);
--> statement-breakpoint
CREATE TABLE "account_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'landing' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"scope" text DEFAULT 'account' NOT NULL,
	"created_by" uuid,
	"document" jsonb NOT NULL,
	"placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "account_templates_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "account_templates_status_check" CHECK ("account_templates"."status" IN ('active', 'retired')),
	CONSTRAINT "account_templates_scope_check" CHECK ("account_templates"."scope" IN ('platform', 'account'))
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"plan_key" text DEFAULT 'starter' NOT NULL,
	"default_locale" text DEFAULT 'en-GB' NOT NULL,
	"deleted_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_status_check" CHECK ("accounts"."status" IN ('active', 'suspended', 'pending_deletion', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "auth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_passkeys" (
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
);
--> statement-breakpoint
CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"active_account_id" uuid,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"step_up_until" timestamp with time zone,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_two_factors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"failed_verification_count" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "backups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"checksum_sha256" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias" text NOT NULL,
	"name" text NOT NULL,
	"group_key" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"wave" integer DEFAULT 1 NOT NULL,
	"admin_only" boolean DEFAULT false NOT NULL,
	"field_count" integer DEFAULT 0 NOT NULL,
	"default_props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "component_definitions_group_check" CHECK ("component_definitions"."group_key" IN ('site-frame', 'conversion', 'money', 'content', 'utility'))
);
--> statement-breakpoint
CREATE TABLE "erasure_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_lookup_hash" text NOT NULL,
	"reason" text NOT NULL,
	"erased_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"public_id" text NOT NULL,
	"customer_number" integer NOT NULL,
	"lookup_hash" text NOT NULL,
	"contact_ciphertext" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guest_contacts_id_account_unique" UNIQUE("id","account_id")
);
--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"source_filename" text NOT NULL,
	"source_size_bytes" integer DEFAULT 0 NOT NULL,
	"report" jsonb,
	"review_decisions" jsonb,
	"error_message" text,
	"created_by" uuid,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_jobs_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "import_jobs_status_check" CHECK ("import_jobs"."status" IN ('uploaded', 'parsing', 'mapped', 'in_review', 'applied', 'failed', 'discarded'))
);
--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"filename" text NOT NULL,
	"original_name" text NOT NULL,
	"storage_key" text NOT NULL,
	"public_url" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"checksum" text NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"uploaded_by" uuid,
	"confirmed_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "media_assets_kind_check" CHECK ("media_assets"."kind" IN ('image', 'document', 'import_reference')),
	CONSTRAINT "media_assets_status_check" CHECK ("media_assets"."status" IN ('pending', 'ready', 'failed', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "media_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"field_path" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_references_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "media_references_source_type_check" CHECK ("media_references"."source_type" IN ('page_draft', 'page_version', 'site_content', 'site_theme', 'page_seo'))
);
--> statement-breakpoint
CREATE TABLE "page_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"document" jsonb NOT NULL,
	"seo" jsonb NOT NULL,
	"title" text NOT NULL,
	"slug_snapshot" text DEFAULT '' NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"source" text DEFAULT 'publish' NOT NULL,
	"note" text,
	"published_by" uuid,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_versions_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "page_versions_source_check" CHECK ("page_versions"."source" IN ('publish', 'manual', 'scheduled', 'rollback', 'import', 'template'))
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"is_homepage" boolean DEFAULT false NOT NULL,
	"draft_document" jsonb NOT NULL,
	"published_version_id" uuid,
	"seo" jsonb NOT NULL,
	"scheduled_publish_at" timestamp with time zone,
	"scheduled_unpublish_at" timestamp with time zone,
	"lock_version" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"first_published_at" timestamp with time zone,
	"last_published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "pages_status_check" CHECK ("pages"."status" IN ('draft', 'published', 'archived', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"key" text PRIMARY KEY NOT NULL,
	"group_key" text NOT NULL,
	"label" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"dangerous" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"key" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"monthly_minor_units" integer NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"max_sites" integer DEFAULT 3 NOT NULL,
	"custom_domains_included" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"encrypted_value" text,
	"is_secret" boolean DEFAULT false NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'landing' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"document" jsonb NOT NULL,
	"placeholders" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_templates_status_check" CHECK ("platform_templates"."status" IN ('active', 'retired'))
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"rank" integer DEFAULT 10 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "short_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"kind" text NOT NULL,
	"target_path" text NOT NULL,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "short_links_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "short_links_kind_check" CHECK ("short_links"."kind" IN ('invitation', 'preview', 'export', 'password_reset', 'my_data'))
);
--> statement-breakpoint
CREATE TABLE "site_contents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"draft_document" jsonb,
	"published_document" jsonb,
	"published_at" timestamp with time zone,
	"updated_by" uuid,
	"lock_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_contents_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "site_contents_kind_check" CHECK ("site_contents"."kind" IN ('navigation', 'footer', 'defaults'))
);
--> statement-breakpoint
CREATE TABLE "site_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"hostname" text NOT NULL,
	"kind" text DEFAULT 'custom' NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verification_token" text,
	"certificate_state" text DEFAULT 'none' NOT NULL,
	"requested_by" uuid,
	"check_attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_domains_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "site_domains_kind_check" CHECK ("site_domains"."kind" IN ('platform_subdomain', 'custom')),
	CONSTRAINT "site_domains_status_check" CHECK ("site_domains"."status" IN ('pending', 'verifying', 'active', 'failed', 'removed')),
	CONSTRAINT "site_domains_cert_state_check" CHECK ("site_domains"."certificate_state" IN ('none', 'pending', 'issued', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"scan_code" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"theme" jsonb NOT NULL,
	"default_locale" text DEFAULT 'en-GB' NOT NULL,
	"custom_css" text,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sites_id_account_unique" UNIQUE("id","account_id"),
	CONSTRAINT "sites_status_check" CHECK ("sites"."status" IN ('active', 'suspended', 'deleted'))
);
--> statement-breakpoint
CREATE TABLE "status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_history_id_account_unique" UNIQUE("id","account_id")
);
--> statement-breakpoint
CREATE TABLE "tracking_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"block_id" text NOT NULL,
	"block_type" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"destination_url" text NOT NULL,
	"tracking_id" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracking_placements_id_account_unique" UNIQUE("id","account_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"image" text,
	"platform_role" text DEFAULT 'none' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"password_changed_at" timestamp with time zone,
	"last_sign_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_platform_role_check" CHECK ("users"."platform_role" IN ('superadmin', 'support', 'auditor', 'none'))
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"claiming_work" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account_audit_logs" ADD CONSTRAINT "account_audit_logs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_audit_logs" ADD CONSTRAINT "account_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_invitations" ADD CONSTRAINT "account_invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_templates" ADD CONSTRAINT "account_templates_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_templates" ADD CONSTRAINT "account_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_templates" ADD CONSTRAINT "account_templates_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_passkeys" ADD CONSTRAINT "auth_passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_active_account_id_accounts_id_fk" FOREIGN KEY ("active_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_two_factors" ADD CONSTRAINT "auth_two_factors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "backups" ADD CONSTRAINT "backups_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_contacts" ADD CONSTRAINT "guest_contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_contacts" ADD CONSTRAINT "guest_contacts_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_references" ADD CONSTRAINT "media_references_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_references" ADD CONSTRAINT "media_references_media_account_fk" FOREIGN KEY ("media_id","account_id") REFERENCES "public"."media_assets"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_references" ADD CONSTRAINT "media_references_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_account_fk" FOREIGN KEY ("page_id","account_id") REFERENCES "public"."pages"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_audit_logs" ADD CONSTRAINT "platform_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "public"."permissions"("key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "short_links" ADD CONSTRAINT "short_links_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_contents" ADD CONSTRAINT "site_contents_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_contents" ADD CONSTRAINT "site_contents_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_contents" ADD CONSTRAINT "site_contents_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site_domains" ADD CONSTRAINT "site_domains_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sites" ADD CONSTRAINT "sites_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_placements" ADD CONSTRAINT "tracking_placements_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_placements" ADD CONSTRAINT "tracking_placements_site_account_fk" FOREIGN KEY ("site_id","account_id") REFERENCES "public"."sites"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_placements" ADD CONSTRAINT "tracking_placements_page_account_fk" FOREIGN KEY ("page_id","account_id") REFERENCES "public"."pages"("id","account_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_audit_logs_account_created_idx" ON "account_audit_logs" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "account_invitations_token_hash_idx" ON "account_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "account_invitations_account_idx" ON "account_invitations" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_members_account_user_idx" ON "account_members" USING btree ("account_id","user_id");--> statement-breakpoint
CREATE INDEX "account_members_user_idx" ON "account_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_templates_account_idx" ON "account_templates" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_slug_idx" ON "accounts" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_accounts_provider_idx" ON "auth_accounts" USING btree ("provider_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "auth_accounts_user_idx" ON "auth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_passkeys_credential_idx" ON "auth_passkeys" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "auth_passkeys_user_idx" ON "auth_passkeys" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_token_idx" ON "auth_sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "auth_sessions_user_idx" ON "auth_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_sessions_expires_idx" ON "auth_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_two_factors_user_idx" ON "auth_two_factors" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "auth_verifications_expires_idx" ON "auth_verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "backups_storage_key_idx" ON "backups" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "component_definitions_alias_idx" ON "component_definitions" USING btree ("alias");--> statement-breakpoint
CREATE INDEX "component_definitions_group_idx" ON "component_definitions" USING btree ("group_key");--> statement-breakpoint
CREATE INDEX "erasure_logs_lookup_idx" ON "erasure_logs" USING btree ("subject_lookup_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_contacts_public_id_idx" ON "guest_contacts" USING btree ("public_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_contacts_site_lookup_idx" ON "guest_contacts" USING btree ("site_id","lookup_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "guest_contacts_site_number_idx" ON "guest_contacts" USING btree ("site_id","customer_number");--> statement-breakpoint
CREATE INDEX "guest_contacts_account_idx" ON "guest_contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "import_jobs_account_site_idx" ON "import_jobs" USING btree ("account_id","site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_storage_key_idx" ON "media_assets" USING btree ("storage_key");--> statement-breakpoint
CREATE UNIQUE INDEX "media_assets_site_checksum_idx" ON "media_assets" USING btree ("site_id","checksum");--> statement-breakpoint
CREATE INDEX "media_assets_account_site_idx" ON "media_assets" USING btree ("account_id","site_id");--> statement-breakpoint
CREATE INDEX "media_references_account_media_idx" ON "media_references" USING btree ("account_id","media_id");--> statement-breakpoint
CREATE UNIQUE INDEX "page_versions_number_idx" ON "page_versions" USING btree ("page_id","version_number");--> statement-breakpoint
CREATE INDEX "page_versions_account_page_idx" ON "page_versions" USING btree ("account_id","page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_site_slug_idx" ON "pages" USING btree ("site_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_one_homepage_idx" ON "pages" USING btree ("site_id") WHERE "pages"."is_homepage" = true AND "pages"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "pages_account_site_status_idx" ON "pages" USING btree ("account_id","site_id","status");--> statement-breakpoint
CREATE INDEX "permissions_group_idx" ON "permissions" USING btree ("group_key");--> statement-breakpoint
CREATE INDEX "plans_monthly_idx" ON "plans" USING btree ("monthly_minor_units");--> statement-breakpoint
CREATE INDEX "platform_audit_logs_created_idx" ON "platform_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_templates_slug_idx" ON "platform_templates" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "role_permissions_key_idx" ON "role_permissions" USING btree ("permission_key");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_key_idx" ON "roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "short_links_code_hash_idx" ON "short_links" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "short_links_account_expires_idx" ON "short_links" USING btree ("account_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "site_contents_site_kind_idx" ON "site_contents" USING btree ("site_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "site_domains_hostname_idx" ON "site_domains" USING btree ("hostname");--> statement-breakpoint
CREATE INDEX "site_domains_account_site_idx" ON "site_domains" USING btree ("account_id","site_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_slug_idx" ON "sites" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "sites_scan_code_idx" ON "sites" USING btree ("scan_code");--> statement-breakpoint
CREATE INDEX "sites_account_status_idx" ON "sites" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "status_history_account_entity_idx" ON "status_history" USING btree ("account_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "tracking_placements_account_page_idx" ON "tracking_placements" USING btree ("account_id","page_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_platform_role_idx" ON "users" USING btree ("platform_role");
--> statement-breakpoint
ALTER TABLE "account_audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_audit_logs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "account_audit_logs" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "account_invitations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_invitations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "account_invitations" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "account_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_members" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "account_members" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "account_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "account_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "account_templates" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "guest_contacts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guest_contacts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "guest_contacts" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "import_jobs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "import_jobs" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "media_assets" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "media_assets" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "media_references" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "media_references" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "media_references" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "page_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "page_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "page_versions" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "pages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "pages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "pages" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "short_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "short_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "short_links" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "site_contents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "site_contents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "site_contents" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "site_domains" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "site_domains" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "site_domains" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "sites" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sites" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "sites" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "status_history" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "status_history" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "status_history" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "tracking_placements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tracking_placements" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "account_isolation" ON "tracking_placements" AS PERMISSIVE FOR ALL TO PUBLIC USING (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid) WITH CHECK (current_setting('app.platform_bypass', true) = 'on' OR "account_id" = NULLIF(current_setting('app.account_id', true), '')::uuid);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION resolve_public_page_snapshot(p_hostname text, p_site_slug text, p_page_slug text)
RETURNS TABLE (
  site_id uuid,
  site_name text,
  site_slug text,
  site_theme jsonb,
  page_id uuid,
  page_title text,
  version_id uuid,
  document jsonb,
  seo jsonb,
  nav_document jsonb,
  footer_document jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text := COALESCE(current_setting('app.platform_bypass', true), '');
  v_site_id uuid;
BEGIN
  PERFORM set_config('app.platform_bypass', 'on', true);

  IF p_hostname IS NOT NULL AND length(trim(p_hostname)) > 0 THEN
    SELECT s.id INTO v_site_id
    FROM site_domains d
    JOIN sites s ON s.id = d.site_id AND s.account_id = d.account_id
    JOIN accounts a ON a.id = s.account_id
    WHERE d.hostname = lower(trim(p_hostname))
      AND d.status = 'active'
      AND d.removed_at IS NULL
      AND s.status = 'active'
      AND s.deleted_at IS NULL
      AND a.status = 'active'
    LIMIT 1;
  END IF;

  IF v_site_id IS NULL AND p_site_slug IS NOT NULL AND length(trim(p_site_slug)) > 0 THEN
    SELECT s.id INTO v_site_id
    FROM sites s
    JOIN accounts a ON a.id = s.account_id
    WHERE s.slug = lower(trim(p_site_slug))
      AND s.status = 'active'
      AND s.deleted_at IS NULL
      AND a.status = 'active'
    LIMIT 1;
  END IF;

  IF v_site_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      s.id,
      s.name,
      s.slug,
      s.theme,
      p.id,
      pv.title,
      pv.id,
      pv.document,
      pv.seo,
      nav.published_document,
      ftr.published_document
    FROM sites s
    JOIN pages p ON p.site_id = s.id AND p.account_id = s.account_id
    JOIN page_versions pv ON pv.id = p.published_version_id AND pv.account_id = p.account_id
    LEFT JOIN site_contents nav ON nav.site_id = s.id AND nav.account_id = s.account_id AND nav.kind = 'navigation'
    LEFT JOIN site_contents ftr ON ftr.site_id = s.id AND ftr.account_id = s.account_id AND ftr.kind = 'footer'
    WHERE s.id = v_site_id
      AND p.status = 'published'
      AND p.deleted_at IS NULL
      AND (p.slug = p_page_slug OR (p_page_slug = '/' AND p.is_homepage = true))
    ORDER BY (p.slug = p_page_slug) DESC
    LIMIT 1;
  END IF;

  PERFORM set_config('app.platform_bypass', v_prev, true);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION verify_active_tls_domain(p_hostname text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text := COALESCE(current_setting('app.platform_bypass', true), '');
  v_ok boolean;
BEGIN
  PERFORM set_config('app.platform_bypass', 'on', true);
  SELECT EXISTS (
    SELECT 1
    FROM site_domains d
    JOIN sites s ON s.id = d.site_id AND s.account_id = d.account_id
    JOIN accounts a ON a.id = s.account_id
    WHERE d.hostname = lower(trim(p_hostname))
      AND d.status = 'active'
      AND d.removed_at IS NULL
      AND s.status = 'active'
      AND s.deleted_at IS NULL
      AND a.status = 'active'
  ) INTO v_ok;
  PERFORM set_config('app.platform_bypass', v_prev, true);
  RETURN COALESCE(v_ok, false);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION resolve_short_link_by_hash(p_code_hash text)
RETURNS TABLE (
  id uuid,
  kind text,
  target_path text,
  expires_at timestamptz,
  consumed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text := COALESCE(current_setting('app.platform_bypass', true), '');
BEGIN
  PERFORM set_config('app.platform_bypass', 'on', true);
  RETURN QUERY
  SELECT sl.id, sl.kind, sl.target_path, sl.expires_at, sl.consumed_at
  FROM short_links sl
  JOIN accounts a ON a.id = sl.account_id
  WHERE sl.code_hash = p_code_hash
    AND a.status = 'active'
  LIMIT 1;
  PERFORM set_config('app.platform_bypass', v_prev, true);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION resolve_scan_share_site(p_segment text)
RETURNS TABLE (
  site_id uuid,
  site_slug text,
  site_name text,
  scan_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text := COALESCE(current_setting('app.platform_bypass', true), '');
BEGIN
  PERFORM set_config('app.platform_bypass', 'on', true);
  RETURN QUERY
  SELECT s.id, s.slug, s.name, s.scan_code
  FROM sites s
  JOIN accounts a ON a.id = s.account_id
  WHERE (s.scan_code = lower(trim(p_segment)) OR s.slug = lower(trim(p_segment)))
    AND s.status = 'active'
    AND s.deleted_at IS NULL
    AND a.status = 'active'
  LIMIT 1;
  PERFORM set_config('app.platform_bypass', v_prev, true);
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION superadmin_reveal_contact(p_contact_id uuid, p_actor_user_id uuid, p_reason text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prev text := COALESCE(current_setting('app.platform_bypass', true), '');
  v_role text;
  v_cipher text;
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) < 8 THEN
    RAISE EXCEPTION 'Reveal reason must be at least 8 characters';
  END IF;

  PERFORM set_config('app.platform_bypass', 'on', true);

  SELECT u.platform_role INTO v_role
  FROM users u
  WHERE u.id = p_actor_user_id AND u.banned = false;

  IF v_role IS DISTINCT FROM 'superadmin' THEN
    PERFORM set_config('app.platform_bypass', v_prev, true);
    RAISE EXCEPTION 'Superadmin role required for contact reveal';
  END IF;

  SELECT gc.contact_ciphertext INTO v_cipher
  FROM guest_contacts gc
  WHERE gc.id = p_contact_id;

  IF v_cipher IS NULL THEN
    PERFORM set_config('app.platform_bypass', v_prev, true);
    RAISE EXCEPTION 'Contact record not found';
  END IF;

  INSERT INTO platform_audit_logs (actor_user_id, action, target_type, target_id, summary, detail)
  VALUES (
    p_actor_user_id,
    'privacy.contact_revealed',
    'guest_contact',
    p_contact_id::text,
    'Superadmin revealed encrypted subscriber contact',
    jsonb_build_object('reason', trim(p_reason))
  );

  PERFORM set_config('app.platform_bypass', v_prev, true);
  RETURN v_cipher;
END;
$$;
