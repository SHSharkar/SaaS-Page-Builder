import "server-only";
import {
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
import type { PageDocument, SiteTheme } from "@/lib/documents";
import {
  GLOBAL_KINDS,
  SITE_STATUSES,
  type GlobalKind,
  type SiteStatus,
} from "@/lib/enums";
import { checkValueInList, createdAndUpdatedColumns } from "../columns";
import { accounts } from "./accounts";
import { users } from "./users";

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    scanCode: text("scan_code").notNull(),
    status: text("status").$type<SiteStatus>().notNull().default("active"),
    theme: jsonb("theme").$type<SiteTheme>().notNull(),
    defaultLocale: text("default_locale").notNull().default("en-GB"),
    customCss: text("custom_css"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("sites_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("sites_slug_idx").on(table.slug),
    uniqueIndex("sites_scan_code_idx").on(table.scanCode),
    index("sites_account_status_idx").on(table.accountId, table.status),
    checkValueInList("sites_status_check", table.status, SITE_STATUSES),
  ],
);

export const siteContents = pgTable(
  "site_contents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    kind: text("kind").$type<GlobalKind>().notNull(),
    draftDocument: jsonb("draft_document").$type<PageDocument | null>(),
    publishedDocument: jsonb("published_document").$type<PageDocument | null>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedBy: uuid("updated_by").references(() => users.id, {
      onDelete: "set null",
    }),
    lockVersion: integer("lock_version").notNull().default(0),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("site_contents_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("site_contents_site_kind_idx").on(table.siteId, table.kind),
    foreignKey({
      name: "site_contents_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
    checkValueInList("site_contents_kind_check", table.kind, GLOBAL_KINDS),
  ],
);

export type SiteRow = typeof sites.$inferSelect;
export type SiteContentRow = typeof siteContents.$inferSelect;
