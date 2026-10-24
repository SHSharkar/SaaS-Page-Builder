import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schemaExports from "@/app/server/db/schema";
import { buildSchemaModel, isTenantTable } from "@/scripts/lib/schema-model";
import { readMigrations } from "@/scripts/lib/sql";

describe("app/server/db/migrations", () => {
  it("enforces forced RLS account_isolation on every table with account_id and resolves all Drizzle FKs", () => {
    const model = buildSchemaModel(process.cwd());
    const tenantTables = [...model.values()].filter(isTenantTable);
    expect(tenantTables.length).toBeGreaterThanOrEqual(16);

    for (const table of tenantTables) {
      expect(table.rlsEnabled, `${table.name} missing ENABLE RLS`).toBe(true);
      expect(table.rlsForced, `${table.name} missing FORCE RLS`).toBe(true);
      expect(
        table.policies.has("account_isolation"),
        `${table.name} missing account_isolation policy`,
      ).toBe(true);
    }

    let inspectedTables = 0;
    for (const exported of Object.values(schemaExports)) {
      if (is(exported, PgTable)) {
        const cfg = getTableConfig(exported);
        for (const fk of cfg.foreignKeys) {
          expect(fk.reference().foreignTable).toBeDefined();
        }
        inspectedTables += 1;
      }
    }
    expect(inspectedTables).toBeGreaterThanOrEqual(32);
  });

  it("matches recorded SHA-256 digests in drizzle/meta/_checksums.json", () => {
    const checksumsPath = path.join(
      process.cwd(),
      "drizzle",
      "meta",
      "_checksums.json",
    );
    const recorded = JSON.parse(
      fs.readFileSync(checksumsPath, "utf8"),
    ) as Record<string, string>;
    for (const mig of readMigrations(process.cwd())) {
      const digest = crypto
        .createHash("sha256")
        .update(mig.sql, "utf8")
        .digest("hex");
      expect(recorded[mig.tag]).toBe(digest);
    }
  });
});
