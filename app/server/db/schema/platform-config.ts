import "server-only";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { BLOCK_GROUPS, type BlockGroup } from "@/lib/enums";
import { checkValueInList, createdAndUpdatedColumns } from "../columns";
import { users } from "./users";

export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>(),
  encryptedValue: text("encrypted_value"),
  isSecret: boolean("is_secret").notNull().default(false),
  description: text("description").notNull().default(""),
  updatedBy: uuid("updated_by").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const componentDefinitions = pgTable(
  "component_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    alias: text("alias").notNull(),
    name: text("name").notNull(),
    groupKey: text("group_key").$type<BlockGroup>().notNull(),
    description: text("description").notNull().default(""),
    wave: integer("wave").notNull().default(1),
    adminOnly: boolean("admin_only").notNull().default(false),
    fieldCount: integer("field_count").notNull().default(0),
    defaultProps: jsonb("default_props")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    uniqueIndex("component_definitions_alias_idx").on(table.alias),
    index("component_definitions_group_idx").on(table.groupKey),
    checkValueInList(
      "component_definitions_group_check",
      table.groupKey,
      BLOCK_GROUPS,
    ),
  ],
);

export const plans = pgTable(
  "plans",
  {
    key: text("key").primaryKey(),
    name: text("name").notNull(),
    monthlyMinorUnits: integer("monthly_minor_units").notNull(),
    currency: text("currency").notNull().default("USD"),
    maxSites: integer("max_sites").notNull().default(3),
    customDomainsIncluded: boolean("custom_domains_included")
      .notNull()
      .default(true),
    ...createdAndUpdatedColumns(),
  },
  (table) => [index("plans_monthly_idx").on(table.monthlyMinorUnits)],
);

export const backups = pgTable(
  "backups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    storageKey: text("storage_key").notNull(),
    checksumSha256: text("checksum_sha256").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("backups_storage_key_idx").on(table.storageKey)],
);

export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  claimingWork: boolean("claiming_work").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
