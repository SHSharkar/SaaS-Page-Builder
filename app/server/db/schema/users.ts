import "server-only";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { PLATFORM_ROLES, type PlatformRole } from "@/lib/enums";
import { checkValueInList, createdAndUpdatedColumns } from "../columns";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    name: text("name").notNull(),
    image: text("image"),
    platformRole: text("platform_role")
      .$type<PlatformRole>()
      .notNull()
      .default("none"),
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    mustChangePassword: boolean("must_change_password")
      .notNull()
      .default(false),
    passwordChangedAt: timestamp("password_changed_at", {
      withTimezone: true,
    }),
    lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    index("users_platform_role_idx").on(table.platformRole),
    checkValueInList(
      "users_platform_role_check",
      table.platformRole,
      PLATFORM_ROLES,
    ),
  ],
);

export type UserRow = typeof users.$inferSelect;
