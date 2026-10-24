import { describe, expect, it } from "vitest";
import { verifyAuthz } from "./verify-authz";
import { verifyCapabilities } from "./verify-capabilities";
import { verifyClientBoundary } from "./verify-client-boundary";
import { contrastRatio, verifyColorContrast } from "./verify-color-contrast";
import { verifyMessageCatalog } from "./verify-message-catalog";
import { verifyMigrationSafety } from "./verify-migration-safety";
import { verifyMigrations } from "./verify-migrations";
import { verifyNaming } from "./verify-naming";
import { planGateSteps } from "./verify-plan";
import { verifyQueuePolicies } from "./verify-queue-policies";
import { verifyRls } from "./verify-rls";
import { verifyRoles } from "./verify-roles";
import { verifyTenantDelete } from "./verify-tenant-delete";
import { classifyVerifyTier } from "./verify-tier";
import { verifyWording } from "./verify-wording";

describe("verify gate suite", () => {
  it("classifies tiers and plans gate steps deterministically", () => {
    expect(classifyVerifyTier(["README.md"], "pre-push")).toBe("fast");
    expect(classifyVerifyTier(["lib/cn.ts"], "pre-push")).toBe("code");
    expect(
      classifyVerifyTier(["drizzle/0000_initial_schema.sql"], "pre-push"),
    ).toBe("schema");
    expect(classifyVerifyTier(["package.json"], "pre-push")).toBe("full");
    expect(planGateSteps("full").length).toBeGreaterThanOrEqual(22);
  });

  it("passes all static architecture, security, schema, and i18n checks", () => {
    expect(contrastRatio("#0f172a", "#ffffff")).toBeGreaterThan(12);
    expect(verifyColorContrast().ok).toBe(true);
    expect(verifyMigrations().ok).toBe(true);
    expect(verifyMigrationSafety().ok).toBe(true);
    expect(verifyRls().ok).toBe(true);
    expect(verifyAuthz().ok).toBe(true);
    expect(verifyCapabilities().ok).toBe(true);
    expect(verifyRoles().ok).toBe(true);
    expect(verifyNaming().ok).toBe(true);
    expect(verifyTenantDelete().ok).toBe(true);
    expect(verifyQueuePolicies().ok).toBe(true);
    expect(verifyMessageCatalog().ok).toBe(true);
    expect(verifyClientBoundary().ok).toBe(true);
    expect(verifyWording().ok).toBe(true);
  });
});
