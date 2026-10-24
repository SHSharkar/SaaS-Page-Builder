import "server-only";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { users } from "./users";

export const accountAuditLogs = pgTable(
  "account_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown> | null>(),
    ipHash: text("ip_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("account_audit_logs_id_account_unique").on(
      table.id,
      table.accountId,
    ),
    index("account_audit_logs_account_created_idx").on(
      table.accountId,
      table.createdAt,
    ),
  ],
);

export const platformAuditLogs = pgTable(
  "platform_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    summary: text("summary").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("platform_audit_logs_created_idx").on(table.createdAt)],
);

export type AccountAuditLogRow = typeof accountAuditLogs.$inferSelect;
export type PlatformAuditLogRow = typeof platformAuditLogs.$inferSelect;
