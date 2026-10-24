import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  ImportMapping,
  ImportReview,
  MediaRef,
  PageDocument,
  PageSeo,
  PlaceholderSpec,
  SiteTheme,
} from "../documents";

/* ------------------------------------------------------------------ *
 * Enums — every state column has a paired reason column where the PRD
 * asks for one (section 3.5).
 * ------------------------------------------------------------------ */

export const userRole = pgEnum("user_role", ["admin", "editor", "viewer"]);
export const userStatus = pgEnum("user_status", ["active", "disabled"]);
export const siteStatus = pgEnum("site_status", ["active", "suspended", "deleted"]);
export const domainKind = pgEnum("domain_kind", ["platform_subdomain", "custom"]);
export const domainStatus = pgEnum("domain_status", [
  "pending",
  "verifying",
  "active",
  "failed",
  "removed",
]);
export const certificateIssuer = pgEnum("certificate_issuer", ["lets_encrypt", "zero_ssl", "none"]);
export const certificateState = pgEnum("certificate_state", ["none", "requested", "issued", "failed"]);
export const siteContentKind = pgEnum("site_content_kind", ["navigation", "footer", "defaults"]);
export const componentGroup = pgEnum("component_group", [
  "site-frame",
  "conversion",
  "money",
  "content",
  "utility",
]);
export const componentStatus = pgEnum("component_status", ["active", "deprecated"]);
export const pageStatus = pgEnum("page_status", ["draft", "published", "archived"]);
export const versionSource = pgEnum("version_source", [
  "manual",
  "template",
  "import",
  "generated",
  "rollback",
]);
export const templateScope = pgEnum("template_scope", ["platform", "staff"]);
export const templateStatus = pgEnum("template_status", ["draft", "active", "retired"]);
export const mediaKind = pgEnum("media_kind", ["image", "file", "import_reference"]);
export const mediaStatus = pgEnum("media_status", ["pending", "ready", "deleted"]);
export const importStatus = pgEnum("import_status", [
  "uploaded",
  "parsing",
  "mapped",
  "in_review",
  "applied",
  "discarded",
  "failed",
]);
export const inviteStatus = pgEnum("invite_status", ["pending", "accepted", "revoked", "expired"]);
export const jobStatus = pgEnum("job_status", ["queued", "running", "done", "failed", "dead"]);
export const auditAction = pgEnum("audit_action", [
  "signed_in",
  "signed_out",
  "sign_in_failed",
  "invite_created",
  "invite_revoked",
  "invite_accepted",
  "invite_expired",
  "user_role_changed",
  "user_disabled",
  "user_enabled",
  "site_created",
  "site_updated",
  "site_suspended",
  "site_deleted",
  "page_created",
  "page_updated",
  "page_deleted",
  "page_published",
  "page_unpublished",
  "page_archived",
  "page_rolled_back",
  "page_scheduled",
  "homepage_set",
  "globals_published",
  "globals_updated",
  "domain_added",
  "domain_verified",
  "domain_failed",
  "domain_removed",
  "media_uploaded",
  "media_deleted",
  "media_delete_blocked",
  "template_created",
  "template_applied",
  "import_uploaded",
  "import_mapped",
  "import_applied",
  "import_discarded",
  "import_failed",
  "settings_changed",
  "step_up_granted",
]);

/* ------------------------------------------------------------------ *
 * M1 Identity & access (T01–T05, T20). Better Auth's tables are
 * reproduced here in the shape the app actually uses; the auth module
 * is the only writer.
 * ------------------------------------------------------------------ */

export const users = pgTable("user", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  passwordHash: text("password_hash"),
  role: userRole("role").notNull().default("editor"),
  status: userStatus("status").notNull().default("active"),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: text("token_hash").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    stepUpUntil: timestamp("step_up_until", { withTimezone: true }),
    pendingTwoFactor: boolean("pending_two_factor").notNull().default(false),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("session_token_hash_idx").on(t.tokenHash), index("session_user_idx").on(t.userId)],
);

/**
 * T20 — the only door into the platform. Invite-only; self-registration
 * does not exist (ADR-002).
 */
export const staffInvites = pgTable(
  "staff_invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    role: userRole("role").notNull().default("editor"),
    tokenHash: text("token_hash").notNull(),
    status: inviteStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("staff_invite_live_email_idx")
      .on(t.email)
      .where(sql`status = 'pending'`),
    index("staff_invite_sweep_idx").on(t.status, t.expiresAt),
  ],
);

/* ------------------------------------------------------------------ *
 * M3 Sites (T09) and global content (T11)
 * ------------------------------------------------------------------ */

export const sites = pgTable(
  "site",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: siteStatus("status").notNull().default("active"),
    theme: jsonb("theme").$type<SiteTheme>().notNull(),
    defaultLocale: text("default_locale").notNull().default("en"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("site_live_slug_idx")
      .on(t.slug)
      .where(sql`deleted_at is null`),
  ],
);

export const siteContents = pgTable(
  "site_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    kind: siteContentKind("kind").notNull(),
    lockVersion: integer("lock_version").notNull().default(0),
    draftDocument: jsonb("draft_document").$type<PageDocument>(),
    publishedDocument: jsonb("published_document").$type<PageDocument>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("site_content_site_kind_idx").on(t.siteId, t.kind)],
);

/* ------------------------------------------------------------------ *
 * M4 Domains (T10)
 * ------------------------------------------------------------------ */

export const domains = pgTable(
  "domain",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    kind: domainKind("kind").notNull().default("custom"),
    status: domainStatus("status").notNull().default("pending"),
    failureReason: text("failure_reason"),
    verificationToken: text("verification_token"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    certificateIssuer: certificateIssuer("certificate_issuer").notNull().default("lets_encrypt"),
    certificateState: certificateState("certificate_state").notNull().default("none"),
    isPrimary: boolean("is_primary").notNull().default(false),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("domain_live_hostname_idx")
      .on(t.hostname)
      .where(sql`removed_at is null`),
    index("domain_site_idx").on(t.siteId),
    index("domain_status_idx").on(t.status),
  ],
);

/* ------------------------------------------------------------------ *
 * M5 Component registry — catalog metadata only; the code is the truth.
 * ------------------------------------------------------------------ */

export const components = pgTable(
  "component",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    alias: text("alias").notNull(),
    displayName: text("display_name").notNull(),
    group: componentGroup("group").notNull(),
    description: text("description").notNull().default(""),
    schemaVersion: integer("schema_version").notNull().default(1),
    status: componentStatus("status").notNull().default("active"),
    previewMediaId: uuid("preview_media_id"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("component_alias_idx").on(t.alias), index("component_group_idx").on(t.group)],
);

/* ------------------------------------------------------------------ *
 * M6 Pages (T13) and versions (T14)
 * ------------------------------------------------------------------ */

export const pages = pgTable(
  "page",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    status: pageStatus("status").notNull().default("draft"),
    isHomepage: boolean("is_homepage").notNull().default(false),
    currentPublishedVersionId: uuid("current_published_version_id"),
    draftDocument: jsonb("draft_document").$type<PageDocument>().notNull(),
    draftUpdatedBy: uuid("draft_updated_by").references(() => users.id, { onDelete: "set null" }),
    lockVersion: integer("lock_version").notNull().default(0),
    seo: jsonb("seo").$type<PageSeo>().notNull(),
    scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }),
    scheduledUnpublishAt: timestamp("scheduled_unpublish_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("page_site_slug_idx")
      .on(t.siteId, t.slug)
      .where(sql`deleted_at is null`),
    uniqueIndex("page_one_homepage_idx")
      .on(t.siteId)
      .where(sql`is_homepage = true and status = 'published' and deleted_at is null`),
    index("page_list_idx").on(t.siteId, t.status, t.updatedAt),
    index("page_schedule_idx").on(t.scheduledPublishAt),
  ],
);

export const pageVersions = pgTable(
  "page_version",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    document: jsonb("document").$type<PageDocument>().notNull(),
    documentSchemaVersion: integer("document_schema_version").notNull().default(1),
    source: versionSource("source").notNull().default("manual"),
    seo: jsonb("seo").$type<PageSeo>().notNull(),
    title: text("title").notNull(),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("page_version_number_idx").on(t.pageId, t.versionNumber),
    index("page_version_history_idx").on(t.pageId, t.publishedAt),
  ],
);

/* ------------------------------------------------------------------ *
 * M7 Templates (T15)
 * ------------------------------------------------------------------ */

export const templates = pgTable(
  "template",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: templateScope("scope").notNull().default("platform"),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Campaign"),
    document: jsonb("document").$type<PageDocument>().notNull(),
    placeholders: jsonb("placeholders").$type<PlaceholderSpec[]>().notNull().default([]),
    previewMediaId: uuid("preview_media_id"),
    accent: text("accent").notNull().default("#c8a24a"),
    status: templateStatus("status").notNull().default("active"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("template_scope_status_idx").on(t.scope, t.status)],
);

/* ------------------------------------------------------------------ *
 * M8 Media (T16)
 * ------------------------------------------------------------------ */

export const mediaAssets = pgTable(
  "media_asset",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    kind: mediaKind("kind").notNull().default("image"),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum").notNull(),
    originalUrl: text("original_url"),
    altText: text("alt_text"),
    status: mediaStatus("status").notNull().default("ready"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("media_site_checksum_idx")
      .on(t.siteId, t.checksum)
      .where(sql`status = 'ready'`),
    index("media_site_status_idx").on(t.siteId, t.status),
    index("media_site_kind_idx").on(t.siteId, t.kind),
  ],
);

/* ------------------------------------------------------------------ *
 * M9 Importer (T17)
 * ------------------------------------------------------------------ */

export const importJobs = pgTable(
  "import_job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    status: importStatus("status").notNull().default("uploaded"),
    failureReason: text("failure_reason"),
    fileMediaId: uuid("file_media_id").references(() => mediaAssets.id, { onDelete: "set null" }),
    sourceName: text("source_name").notNull(),
    mappingResult: jsonb("mapping_result").$type<ImportMapping>(),
    reviewResult: jsonb("review_result").$type<ImportReview>(),
    producedPageId: uuid("produced_page_id").references(() => pages.id, { onDelete: "set null" }),
    llmUsage: jsonb("llm_usage").$type<{ model: string; tokensIn: number; tokensOut: number } | null>(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("import_site_status_idx").on(t.siteId, t.status), index("import_creator_idx").on(t.createdBy)],
);

/* ------------------------------------------------------------------ *
 * M11 Platform operations (T18, T19) and the queue
 * ------------------------------------------------------------------ */

export const platformSettings = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>(),
  isSecret: boolean("is_secret").notNull().default(false),
  encryptedValue: text("encrypted_value"),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorRoleSnapshot: text("actor_role_snapshot"),
    action: auditAction("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_site_created_idx").on(t.siteId, t.createdAt),
    index("audit_created_idx").on(t.createdAt),
  ],
);

/**
 * The queue. `job` is the pg-boss pattern in miniature: at-least-once
 * delivery, exponential backoff with jitter, dead-letter after the cap.
 */
export const jobs = pgTable(
  "job",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: jobStatus("status").notNull().default("queued"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    dedupeKey: text("dedupe_key"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("job_poll_idx").on(t.status, t.runAt),
    uniqueIndex("job_dedupe_idx")
      .on(t.dedupeKey)
      .where(sql`dedupe_key is not null and status in ('queued','running')`),
  ],
);

export const pageRelations = relations(pages, ({ many }) => ({
  versions: many(pageVersions),
}));

export const versionRelations = relations(pageVersions, ({ one }) => ({
  page: one(pages, { fields: [pageVersions.pageId], references: [pages.id] }),
}));

export type User = typeof users.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type SiteContent = typeof siteContents.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageVersion = typeof pageVersions.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type ImportJob = typeof importJobs.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type StaffInvite = typeof staffInvites.$inferSelect;
export type Job = typeof jobs.$inferSelect;
