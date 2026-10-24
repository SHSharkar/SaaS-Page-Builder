import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
  "site_restored",
  "site_purged",
  "page_created",
  "page_updated",
  "page_deleted",
  "page_published",
  "page_unpublished",
  "page_archived",
  "page_restored",
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
  "media_confirmed",
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
  "cleanup_ran",
  "account_created",
  "account_updated",
  "account_suspended",
  "account_reactivated",
  "password_changed",
  "password_reset_requested",
  "roles_assigned",
  "role_created",
  "role_updated",
  "role_deleted",
  "session_revoked",
  "two_factor_enabled",
  "two_factor_disabled",
]);

/* ------------------------------------------------------------------ *
 * M1 Identity & access. Better Auth owns identity (user, account,
 * session, verification, two-factor); this app owns authorization
 * (role, permission, role_permission, user_role) and invitations.
 * ------------------------------------------------------------------ */

export const users = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** App-level suspension. Sign-in and every session are refused while disabled. */
    status: userStatus("status").notNull().default("active"),
    /** Set when an admin creates an account or resets a password. */
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_email_idx").on(t.email), index("user_status_idx").on(t.status)],
);

/** Better Auth credential and (later) social accounts. The only writer is Better Auth. */
export const accounts = pgTable(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("account_provider_account_idx").on(t.providerId, t.accountId),
    index("account_user_idx").on(t.userId),
  ],
);

export const sessions = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    /** Fresh-proof window for sensitive acts, owned by this app. */
    stepUpUntil: timestamp("step_up_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("session_token_idx").on(t.token), index("session_user_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const twoFactors = pgTable(
  "two_factor",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
    /** Anti-bruteforce counters the two-factor plugin expects to own. */
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("two_factor_user_idx").on(t.userId)],
);

/**
 * Authorization. Roles are rows, permissions are rows, and the join tables are
 * the only thing a guard reads. The catalogue of permission keys lives in
 * `lib/auth/permissions.ts` so code and data cannot drift apart.
 */
export const roles = pgTable(
  "role",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    rank: integer("rank").notNull().default(0),
    isSystem: boolean("is_system").notNull().default(false),
    /**
     * Whether the code-defined grants have been written into this role once.
     * After that the matrix in /admin/roles owns them, so an admin can narrow
     * Editor or Viewer without the next boot undoing it.
     */
    permissionsSeeded: boolean("permissions_seeded").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("role_key_idx").on(t.key)],
);

export const permissions = pgTable(
  "permission",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    groupKey: text("group_key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    dangerous: boolean("dangerous").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("permission_key_idx").on(t.key)],
);

export const rolePermissions = pgTable(
  "role_permission",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRoles = pgTable(
  "user_role",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    assignedBy: uuid("assigned_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] }), index("user_role_role_idx").on(t.roleId)],
);

/**
 * T20 — the only door into the platform. Invite-only; self-registration
 * does not exist (ADR-002). The role is a row, so a custom role can be
 * attached to an invitation.
 */
export const staffInvites = pgTable(
  "staff_invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
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
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type SessionRecord = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Job = typeof jobs.$inferSelect;
