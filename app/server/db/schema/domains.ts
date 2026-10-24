import "server-only";
import {
  boolean,
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
  CERTIFICATE_STATES,
  DOMAIN_KINDS,
  DOMAIN_STATUSES,
  type CertificateState,
  type DomainKind,
  type DomainStatus,
} from "@/lib/enums";
import { checkValueInList, createdAndUpdatedColumns } from "../columns";
import { accounts } from "./accounts";
import { sites } from "./sites";
import { users } from "./users";

export const siteDomains = pgTable(
  "site_domains",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    hostname: text("hostname").notNull(),
    kind: text("kind").$type<DomainKind>().notNull().default("custom"),
    isPrimary: boolean("is_primary").notNull().default(false),
    status: text("status").$type<DomainStatus>().notNull().default("pending"),
    verificationToken: text("verification_token"),
    certificateState: text("certificate_state")
      .$type<CertificateState>()
      .notNull()
      .default("none"),
    requestedBy: uuid("requested_by").references(() => users.id, {
      onDelete: "set null",
    }),
    checkAttempts: integer("check_attempts").notNull().default(0),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    failureReason: text("failure_reason"),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("site_domains_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("site_domains_hostname_idx").on(table.hostname),
    index("site_domains_account_site_idx").on(table.accountId, table.siteId),
    foreignKey({
      name: "site_domains_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
    checkValueInList("site_domains_kind_check", table.kind, DOMAIN_KINDS),
    checkValueInList(
      "site_domains_status_check",
      table.status,
      DOMAIN_STATUSES,
    ),
    checkValueInList(
      "site_domains_cert_state_check",
      table.certificateState,
      CERTIFICATE_STATES,
    ),
  ],
);

export type SiteDomainRow = typeof siteDomains.$inferSelect;
