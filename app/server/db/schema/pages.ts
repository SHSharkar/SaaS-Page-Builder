import "server-only";
import { sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { PageDocument, PageSeo } from "@/lib/documents";
import {
  PAGE_STATUSES,
  VERSION_SOURCES,
  type PageStatus,
  type VersionSource,
} from "@/lib/enums";
import { checkValueInList, createdAndUpdatedColumns } from "../columns";
import { accounts } from "./accounts";
import { sites } from "./sites";
import { users } from "./users";

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    status: text("status").$type<PageStatus>().notNull().default("draft"),
    isHomepage: boolean("is_homepage").notNull().default(false),
    draftDocument: jsonb("draft_document").$type<PageDocument>().notNull(),
    publishedVersionId: uuid("published_version_id"),
    seo: jsonb("seo").$type<PageSeo>().notNull(),
    scheduledPublishAt: timestamp("scheduled_publish_at", {
      withTimezone: true,
    }),
    scheduledUnpublishAt: timestamp("scheduled_unpublish_at", {
      withTimezone: true,
    }),
    lockVersion: integer("lock_version").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    firstPublishedAt: timestamp("first_published_at", { withTimezone: true }),
    lastPublishedAt: timestamp("last_published_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("pages_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("pages_site_slug_idx").on(table.siteId, table.slug),
    uniqueIndex("pages_one_homepage_idx")
      .on(table.siteId)
      .where(sql`${table.isHomepage} = true AND ${table.deletedAt} IS NULL`),
    index("pages_account_site_status_idx").on(
      table.accountId,
      table.siteId,
      table.status,
    ),
    foreignKey({
      name: "pages_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
    checkValueInList("pages_status_check", table.status, PAGE_STATUSES),
  ],
);

export const pageVersions = pgTable(
  "page_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    document: jsonb("document").$type<PageDocument>().notNull(),
    seo: jsonb("seo").$type<PageSeo>().notNull(),
    title: text("title").notNull(),
    slugSnapshot: text("slug_snapshot").notNull().default(""),
    schemaVersion: integer("schema_version").notNull().default(1),
    source: text("source").$type<VersionSource>().notNull().default("publish"),
    note: text("note"),
    publishedBy: uuid("published_by").references(() => users.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("page_versions_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("page_versions_number_idx").on(
      table.pageId,
      table.versionNumber,
    ),
    index("page_versions_account_page_idx").on(table.accountId, table.pageId),
    foreignKey({
      name: "page_versions_page_account_fk",
      columns: [table.pageId, table.accountId],
      foreignColumns: [pages.id, pages.accountId],
    }).onDelete("cascade"),
    checkValueInList(
      "page_versions_source_check",
      table.source,
      VERSION_SOURCES,
    ),
  ],
);

export const trackingPlacements = pgTable(
  "tracking_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    pageId: uuid("page_id").notNull(),
    blockId: text("block_id").notNull(),
    blockType: text("block_type").notNull(),
    label: text("label").notNull().default(""),
    destinationUrl: text("destination_url").notNull(),
    trackingId: text("tracking_id").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("tracking_placements_id_account_unique").on(
      table.id,
      table.accountId,
    ),
    index("tracking_placements_account_page_idx").on(
      table.accountId,
      table.pageId,
    ),
    foreignKey({
      name: "tracking_placements_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
    foreignKey({
      name: "tracking_placements_page_account_fk",
      columns: [table.pageId, table.accountId],
      foreignColumns: [pages.id, pages.accountId],
    }).onDelete("cascade"),
  ],
);

export type PageRow = typeof pages.$inferSelect;
export type PageVersionRow = typeof pageVersions.$inferSelect;
