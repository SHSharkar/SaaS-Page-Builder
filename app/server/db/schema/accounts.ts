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
import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  INVITE_STATUSES,
  type AccountRole,
  type AccountStatus,
  type InviteStatus,
} from "@/lib/enums";
import { checkValueInList, createdAndUpdatedColumns } from "../columns";
import { users } from "./users";

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").$type<AccountStatus>().notNull().default("active"),
    planKey: text("plan_key").notNull().default("starter"),
    defaultLocale: text("default_locale").notNull().default("en-GB"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    purgeAfter: timestamp("purge_after", { withTimezone: true }),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    uniqueIndex("accounts_slug_idx").on(table.slug),
    index("accounts_status_idx").on(table.status),
    checkValueInList("accounts_status_check", table.status, ACCOUNT_STATUSES),
  ],
);

export const accountMembers = pgTable(
  "account_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<AccountRole>().notNull().default("viewer"),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("account_members_id_account_unique").on(table.id, table.accountId),
    uniqueIndex("account_members_account_user_idx").on(
      table.accountId,
      table.userId,
    ),
    index("account_members_user_idx").on(table.userId),
    checkValueInList("account_members_role_check", table.role, ACCOUNT_ROLES),
  ],
);

export const accountInvitations = pgTable(
  "account_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<AccountRole>().notNull().default("editor"),
    tokenHash: text("token_hash").notNull(),
    status: text("status").$type<InviteStatus>().notNull().default("pending"),
    invitedBy: uuid("invited_by").references(() => users.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("account_invitations_id_account_unique").on(
      table.id,
      table.accountId,
    ),
    uniqueIndex("account_invitations_token_hash_idx").on(table.tokenHash),
    index("account_invitations_account_idx").on(table.accountId),
    checkValueInList(
      "account_invitations_role_check",
      table.role,
      ACCOUNT_ROLES,
    ),
    checkValueInList(
      "account_invitations_status_check",
      table.status,
      INVITE_STATUSES,
    ),
  ],
);

export type AccountRow = typeof accounts.$inferSelect;
export type AccountMemberRow = typeof accountMembers.$inferSelect;
export type AccountInvitationRow = typeof accountInvitations.$inferSelect;
