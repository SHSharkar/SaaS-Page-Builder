import { describe, expect, it } from "vitest";
import { setTestSessionContext } from "@/app/server/auth/session";
import { createTestWorkspaceFixture } from "@/app/server/test-support";
import { requireAdminConsoleSession } from "./admin-session";
import { buildAdminTabs } from "./admin-tabs";

describe("admin tabs and session", () => {
  it("hides superadmin privacy tab from support operators and shows it for superadmin", async () => {
    const supportTabs = buildAdminTabs({
      adminPath: "/ops-console",
      platformRole: "support",
      t: (k) => k,
    });
    expect(supportTabs.some((item) => item.href.endsWith("/privacy"))).toBe(
      false,
    );

    const superTabs = buildAdminTabs({
      adminPath: "/ops-console",
      platformRole: "superadmin",
      t: (k) => k,
    });
    expect(superTabs.some((item) => item.href.endsWith("/privacy"))).toBe(true);

    const ctx = await createTestWorkspaceFixture({
      accountRole: "owner",
      platformRole: "superadmin",
    });
    const adminActor = await requireAdminConsoleSession();
    expect(adminActor.user.id).toBe(ctx.user.id);
    setTestSessionContext(null);
  });
});
