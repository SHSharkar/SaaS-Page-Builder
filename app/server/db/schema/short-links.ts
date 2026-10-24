import "server-only";
import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { SHORT_LINK_KINDS, type ShortLinkKind } from "@/lib/enums";
import { checkValueInList } from "../columns";
import { accounts } from "./accounts";
import { users } from "./users";

export const shortLinks = pgTable(
  "short_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    kind: text("kind").$type<ShortLinkKind>().notNull(),
    targetPath: text("target_path").notNull(),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("short_links_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("short_links_code_hash_idx").on(table.codeHash),
    index("short_links_account_expires_idx").on(
      table.accountId,
      table.expiresAt,
    ),
    checkValueInList("short_links_kind_check", table.kind, SHORT_LINK_KINDS),
  ],
);

export type ShortLinkRow = typeof shortLinks.$inferSelect;
