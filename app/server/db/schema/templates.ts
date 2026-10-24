import "server-only";
import {
  foreignKey,
  index,
  jsonb,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { PageDocument, TemplatePlaceholder } from "@/lib/documents";
import {
  TEMPLATE_SCOPES,
  TEMPLATE_STATUSES,
  type TemplateScope,
  type TemplateStatus,
} from "@/lib/enums";
import { checkValueInList, createdAndUpdatedColumns } from "../columns";
import { accounts } from "./accounts";
import { sites } from "./sites";
import { users } from "./users";

export const platformTemplates = pgTable(
  "platform_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("landing"),
    status: text("status").$type<TemplateStatus>().notNull().default("active"),
    document: jsonb("document").$type<PageDocument>().notNull(),
    placeholders: jsonb("placeholders")
      .$type<TemplatePlaceholder[]>()
      .notNull()
      .default([]),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    uniqueIndex("platform_templates_slug_idx").on(table.slug),
    checkValueInList(
      "platform_templates_status_check",
      table.status,
      TEMPLATE_STATUSES,
    ),
  ],
);

export const accountTemplates = pgTable(
  "account_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("landing"),
    status: text("status").$type<TemplateStatus>().notNull().default("active"),
    scope: text("scope").$type<TemplateScope>().notNull().default("account"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    document: jsonb("document").$type<PageDocument>().notNull(),
    placeholders: jsonb("placeholders")
      .$type<TemplatePlaceholder[]>()
      .notNull()
      .default([]),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("account_templates_id_account_unique").on(table.id, table.accountId),
    index("account_templates_account_idx").on(table.accountId),
    foreignKey({
      name: "account_templates_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
    checkValueInList(
      "account_templates_status_check",
      table.status,
      TEMPLATE_STATUSES,
    ),
    checkValueInList(
      "account_templates_scope_check",
      table.scope,
      TEMPLATE_SCOPES,
    ),
  ],
);

export type PlatformTemplateRow = typeof platformTemplates.$inferSelect;
export type AccountTemplateRow = typeof accountTemplates.$inferSelect;
