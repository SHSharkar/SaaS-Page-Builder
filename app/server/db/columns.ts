import "server-only";
import { sql, type Column } from "drizzle-orm";
import { check, timestamp } from "drizzle-orm/pg-core";

export function checkValueInList(
  constraintName: string,
  column: Column,
  values: readonly string[],
) {
  const escaped = values
    .map((val) => `'${val.replace(/'/g, "''")}'`)
    .join(", ");
  return check(constraintName, sql`${column} IN (${sql.raw(escaped)})`);
}

export function createdAndUpdatedColumns() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  };
}
