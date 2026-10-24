import "server-only";
import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { accounts } from "./accounts";
import { users } from "./users";

export const statusHistory = pgTable(
  "status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedBy: uuid("changed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("status_history_id_account_unique").on(table.id, table.accountId),
    index("status_history_account_entity_idx").on(
      table.accountId,
      table.entityType,
      table.entityId,
    ),
  ],
);
