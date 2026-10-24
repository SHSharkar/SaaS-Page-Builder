import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  ImportReport,
  ImportReviewDecision,
  ImportSegment,
  PageDocument,
  PageSeo,
  SiteTheme,
  TemplatePlaceholder,
} from "@/lib/documents";
import type {
  BlockGroup,
  CertificateState,
  DomainKind,
  DomainStatus,
  GlobalKind,
  ImportStatus,
  InviteStatus,
  LlmAdapterKind,
  MediaKind,
  MediaRefSource,
  MediaStatus,
  PageStatus,
  SiteStatus,
  TemplateScope,
  TemplateStatus,
  VersionSource,
} from "@/lib/enums";

export type { ImportReport, ImportSegment };

export const roles = pgTable("role", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  rank: integer("rank").notNull().default(0),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable(
  "permission",
  {
    key: text("key").primaryKey(),
    groupKey: text("group_key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    dangerous: boolean("dangerous").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("permission_group_idx").on(table.groupKey)],
);

export const rolePermissions = pgTable(
  "role_permission",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionKey] }),
    index("role_permission_key_idx").on(table.permissionKey),
  ],
);

export const users = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name").notNull(),
    image: text("image"),
    role: text("role")
      .notNull()
      .default("viewer")
      .references(() => roles.key, { onDelete: "restrict", onUpdate: "cascade" }),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_email_idx").on(table.email),
    index("user_role_idx").on(table.role),
    index("user_banned_idx").on(table.banned),
  ],
);

export const sessions = pgTable(
  "session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    stepUpUntil: timestamp("step_up_until", { withTimezone: true }),
    impersonatedBy: text("impersonated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("session_token_idx").on(table.token),
    index("session_user_idx").on(table.userId),
    index("session_expires_idx").on(table.expiresAt),
  ],
);

export const accounts = pgTable(
  "account",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
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
  (table) => [
    uniqueIndex("account_provider_idx").on(table.providerId, table.accountId),
    index("account_user_idx").on(table.userId),
  ],
);

export const verifications = pgTable(
  "verification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("verification_identifier_idx").on(table.identifier),
    index("verification_expires_idx").on(table.expiresAt),
  ],
);

export const twoFactors = pgTable(
  "two_factor",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    verified: boolean("verified").notNull().default(true),
    failedVerificationCount: integer("failed_verification_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("two_factor_user_idx").on(table.userId)],
);

export const passkeys = pgTable(
  "passkey",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull().default(0),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull().default(false),
    transports: text("transports"),
    aaguid: text("aaguid"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("passkey_credential_idx").on(table.credentialID),
    index("passkey_user_idx").on(table.userId),
  ],
);

export const staffInvites = pgTable(
  "staff_invite",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    tokenHash: text("token_hash").notNull(),
    status: text("status").$type<InviteStatus>().notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedUserId: uuid("accepted_user_id").references(() => users.id, { onDelete: "set null" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("staff_invite_token_idx").on(table.tokenHash),
    index("staff_invite_email_idx").on(table.email),
    index("staff_invite_role_idx").on(table.roleId),
  ],
);

export const sites = pgTable(
  "site",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status").$type<SiteStatus>().notNull().default("active"),
    theme: jsonb("theme").$type<SiteTheme>().notNull(),
    defaultLocale: text("default_locale").notNull().default("en"),
    customCss: text("custom_css"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("site_slug_idx").on(table.slug),
    index("site_status_idx").on(table.status),
  ],
);

export const siteContents = pgTable(
  "site_content",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    kind: text("kind").$type<GlobalKind>().notNull(),
    draftDocument: jsonb("draft_document").$type<PageDocument | null>(),
    publishedDocument: jsonb("published_document").$type<PageDocument | null>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    lockVersion: integer("lock_version").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("site_content_site_kind_idx").on(table.siteId, table.kind)],
);

export const domains = pgTable(
  "domain",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    kind: text("kind").$type<DomainKind>().notNull().default("custom"),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").$type<DomainStatus>().notNull().default("pending"),
    verificationToken: text("verification_token"),
    verificationMethod: text("verification_method").notNull().default("txt"),
    certificateIssuer: text("certificate_issuer").notNull().default("lets_encrypt"),
    certificateState: text("certificate_state")
      .$type<CertificateState>()
      .notNull()
      .default("none"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    checkAttempts: integer("check_attempts").notNull().default(0),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("domain_hostname_idx").on(table.hostname),
    index("domain_site_idx").on(table.siteId),
    index("domain_status_idx").on(table.status),
  ],
);

export const pages = pgTable(
  "page",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    status: text("status").$type<PageStatus>().notNull().default("draft"),
    isHomepage: boolean("is_homepage").notNull().default(false),
    draftDocument: jsonb("draft_document").$type<PageDocument>().notNull(),
    publishedVersionId: uuid("published_version_id"),
    seo: jsonb("seo").$type<PageSeo>().notNull(),
    scheduledPublishAt: timestamp("scheduled_publish_at", { withTimezone: true }),
    scheduledUnpublishAt: timestamp("scheduled_unpublish_at", { withTimezone: true }),
    lockVersion: integer("lock_version").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("page_site_slug_idx").on(table.siteId, table.slug),
    uniqueIndex("page_one_homepage_idx")
      .on(table.siteId)
      .where(sql`${table.isHomepage} = true and ${table.deletedAt} is null`),
    index("page_site_status_idx").on(table.siteId, table.status),
  ],
);

export const pageVersions = pgTable(
  "page_version",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pageId: uuid("page_id")
      .notNull()
      .references((): AnyPgColumn => pages.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    document: jsonb("document").$type<PageDocument>().notNull(),
    seo: jsonb("seo").$type<PageSeo>().notNull(),
    title: text("title").notNull(),
    slugSnapshot: text("slug_snapshot").notNull().default(""),
    schemaVersion: integer("schema_version").notNull().default(1),
    source: text("source").$type<VersionSource>().notNull().default("publish"),
    note: text("note"),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("page_version_number_idx").on(table.pageId, table.versionNumber),
    index("page_version_page_idx").on(table.pageId),
  ],
);

export const componentDefinitions = pgTable(
  "component_definition",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    alias: text("alias").notNull(),
    name: text("name").notNull(),
    groupKey: text("group_key").$type<BlockGroup>().notNull(),
    description: text("description").notNull().default(""),
    schemaVersion: integer("schema_version").notNull().default(1),
    wave: integer("wave").notNull().default(1),
    adminOnly: boolean("admin_only").notNull().default(false),
    deprecated: boolean("deprecated").notNull().default(false),
    fieldCount: integer("field_count").notNull().default(0),
    schemaJson: jsonb("schema_json").$type<Record<string, unknown>[]>().notNull().default([]),
    defaultProps: jsonb("default_props").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("component_definition_alias_idx").on(table.alias),
    index("component_definition_group_idx").on(table.groupKey),
  ],
);

export const mediaAssets = pgTable(
  "media_asset",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    kind: text("kind").$type<MediaKind>().notNull().default("image"),
    status: text("status").$type<MediaStatus>().notNull().default("ready"),
    filename: text("filename").notNull(),
    originalName: text("original_name").notNull(),
    storageKey: text("storage_key").notNull(),
    publicUrl: text("public_url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    checksum: text("checksum").notNull(),
    altText: text("alt_text").notNull().default(""),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("media_storage_key_idx").on(table.storageKey),
    uniqueIndex("media_site_checksum_idx").on(table.siteId, table.checksum),
    index("media_site_idx").on(table.siteId),
    index("media_status_idx").on(table.status),
  ],
);

export const mediaReferences = pgTable(
  "media_reference",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mediaId: uuid("media_id")
      .notNull()
      .references(() => mediaAssets.id, { onDelete: "cascade" }),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    sourceType: text("source_type").$type<MediaRefSource>().notNull(),
    sourceId: uuid("source_id").notNull(),
    fieldPath: text("field_path").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("media_reference_media_idx").on(table.mediaId),
    index("media_reference_source_idx").on(table.siteId, table.sourceType, table.sourceId),
  ],
);

export const templates = pgTable(
  "template",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().default(""),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("landing"),
    status: text("status").$type<TemplateStatus>().notNull().default("active"),
    scope: text("scope").$type<TemplateScope>().notNull().default("platform"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    previewMediaId: uuid("preview_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    accent: text("accent").notNull().default("#c8a24a"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    document: jsonb("document").$type<PageDocument>().notNull(),
    placeholders: jsonb("placeholders").$type<TemplatePlaceholder[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("template_site_idx").on(table.siteId),
    index("template_status_idx").on(table.status),
  ],
);

export const importJobs = pgTable(
  "import_job",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    targetPageId: uuid("target_page_id").references(() => pages.id, {
      onDelete: "set null",
    }),
    status: text("status").$type<ImportStatus>().notNull().default("uploaded"),
    sourceType: text("source_type").notNull().default("html"),
    sourceFilename: text("source_filename").notNull(),
    sourceMediaId: uuid("source_media_id").references(() => mediaAssets.id, {
      onDelete: "set null",
    }),
    sourceSizeBytes: integer("source_size_bytes").notNull().default(0),
    extractedMeta: jsonb("extracted_meta").$type<Record<string, unknown>>().notNull().default({}),
    report: jsonb("report").$type<ImportReport>(),
    reviewDecisions: jsonb("review_decisions").$type<ImportReviewDecision[]>(),
    errorMessage: text("error_message"),
    llmAdapter: text("llm_adapter").$type<LlmAdapterKind>().notNull().default("none"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("import_job_site_idx").on(table.siteId),
    index("import_job_status_idx").on(table.status),
  ],
);

export const trackingPlacements = pgTable(
  "tracking_placement",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    siteId: uuid("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "cascade" }),
    blockId: text("block_id").notNull(),
    blockType: text("block_type").notNull().default(""),
    label: text("label").notNull().default(""),
    destinationUrl: text("destination_url").notNull(),
    trackingId: text("tracking_id").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("tracking_placement_site_page_idx").on(table.siteId, table.pageId)],
);

export const auditEntries = pgTable(
  "audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorEmailSnapshot: text("actor_email_snapshot"),
    actorRoleSnapshot: text("actor_role_snapshot"),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown> | null>(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_site_created_idx").on(table.siteId, table.createdAt),
    index("audit_actor_idx").on(table.actorUserId),
    index("audit_created_idx").on(table.createdAt),
  ],
);

export const platformSettings = pgTable("platform_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>(),
  encryptedValue: text("encrypted_value"),
  isSecret: boolean("is_secret").notNull().default(false),
  description: text("description").notNull().default(""),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type StaffInvite = typeof staffInvites.$inferSelect;
export type Site = typeof sites.$inferSelect;
export type SiteContent = typeof siteContents.$inferSelect;
export type Domain = typeof domains.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageVersion = typeof pageVersions.$inferSelect;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type Template = typeof templates.$inferSelect;
export type ImportJob = typeof importJobs.$inferSelect;
export type AuditEntry = typeof auditEntries.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;
