import "server-only";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAndUpdatedColumns } from "../columns";

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    rank: integer("rank").notNull().default(10),
    isSystem: boolean("is_system").notNull().default(false),
    ...createdAndUpdatedColumns(),
  },
  (table) => [uniqueIndex("roles_key_idx").on(table.key)],
);

export const permissions = pgTable(
  "permissions",
  {
    key: text("key").primaryKey(),
    groupKey: text("group_key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull().default(""),
    dangerous: boolean("dangerous").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("permissions_group_idx").on(table.groupKey)],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roleId, table.permissionKey] }),
    index("role_permissions_key_idx").on(table.permissionKey),
  ],
);
