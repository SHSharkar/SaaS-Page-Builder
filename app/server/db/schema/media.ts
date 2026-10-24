import "server-only";
import {
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  MEDIA_KINDS,
  MEDIA_REF_SOURCES,
  MEDIA_STATUSES,
  type MediaKind,
  type MediaRefSource,
  type MediaStatus,
} from "@/lib/enums";
import { checkValueInList } from "../columns";
import { accounts } from "./accounts";
import { sites } from "./sites";
import { users } from "./users";

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
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
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("media_assets_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("media_assets_storage_key_idx").on(table.storageKey),
    uniqueIndex("media_assets_site_checksum_idx").on(
      table.siteId,
      table.checksum,
    ),
    index("media_assets_account_site_idx").on(table.accountId, table.siteId),
    foreignKey({
      name: "media_assets_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
    checkValueInList("media_assets_kind_check", table.kind, MEDIA_KINDS),
    checkValueInList("media_assets_status_check", table.status, MEDIA_STATUSES),
  ],
);

export const mediaReferences = pgTable(
  "media_references",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").notNull(),
    siteId: uuid("site_id").notNull(),
    sourceType: text("source_type").$type<MediaRefSource>().notNull(),
    sourceId: uuid("source_id").notNull(),
    fieldPath: text("field_path").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("media_references_id_account_unique").on(table.id, table.accountId),
    index("media_references_account_media_idx").on(
      table.accountId,
      table.mediaId,
    ),
    foreignKey({
      name: "media_references_media_account_fk",
      columns: [table.mediaId, table.accountId],
      foreignColumns: [mediaAssets.id, mediaAssets.accountId],
    }).onDelete("cascade"),
    foreignKey({
      name: "media_references_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
    checkValueInList(
      "media_references_source_type_check",
      table.sourceType,
      MEDIA_REF_SOURCES,
    ),
  ],
);

export type MediaAssetRow = typeof mediaAssets.$inferSelect;
