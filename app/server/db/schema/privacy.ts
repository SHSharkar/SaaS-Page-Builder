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
import { createdAndUpdatedColumns } from "../columns";
import { accounts } from "./accounts";
import { sites } from "./sites";

export const guestContacts = pgTable(
  "guest_contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    publicId: text("public_id").notNull(),
    customerNumber: integer("customer_number").notNull(),
    lookupHash: text("lookup_hash").notNull(),
    contactCiphertext: text("contact_ciphertext").notNull(),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("guest_contacts_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("guest_contacts_public_id_idx").on(table.publicId),
    uniqueIndex("guest_contacts_site_lookup_idx").on(
      table.siteId,
      table.lookupHash,
    ),
    uniqueIndex("guest_contacts_site_number_idx").on(
      table.siteId,
      table.customerNumber,
    ),
    index("guest_contacts_account_idx").on(table.accountId),
    foreignKey({
      name: "guest_contacts_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
  ],
);

export const erasureLogs = pgTable(
  "erasure_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    subjectLookupHash: text("subject_lookup_hash").notNull(),
    reason: text("reason").notNull(),
    erasedAt: timestamp("erased_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("erasure_logs_lookup_idx").on(table.subjectLookupHash)],
);

export type GuestContactRow = typeof guestContacts.$inferSelect;
