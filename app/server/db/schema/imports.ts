import "server-only";
import {
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { ImportReport, ImportReviewDecision } from "@/lib/documents";
import { IMPORT_STATUSES, type ImportStatus } from "@/lib/enums";
import { checkValueInList, createdAndUpdatedColumns } from "../columns";
import { accounts } from "./accounts";
import { sites } from "./sites";
import { users } from "./users";

export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").notNull(),
    status: text("status").$type<ImportStatus>().notNull().default("uploaded"),
    sourceFilename: text("source_filename").notNull(),
    sourceSizeBytes: integer("source_size_bytes").notNull().default(0),
    report: jsonb("report").$type<ImportReport>(),
    reviewDecisions: jsonb("review_decisions").$type<ImportReviewDecision[]>(),
    errorMessage: text("error_message"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    ...createdAndUpdatedColumns(),
  },
  (table) => [
    unique("import_jobs_id_account_unique").on(table.id, table.accountId),
    index("import_jobs_account_site_idx").on(table.accountId, table.siteId),
    foreignKey({
      name: "import_jobs_site_account_fk",
      columns: [table.siteId, table.accountId],
      foreignColumns: [sites.id, sites.accountId],
    }).onDelete("cascade"),
    checkValueInList("import_jobs_status_check", table.status, IMPORT_STATUSES),
  ],
);

export type ImportJobRow = typeof importJobs.$inferSelect;
