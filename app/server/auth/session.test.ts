import { describe, expect, it, vi } from "vitest";
import { authSessions } from "@/app/server/db/schema";
import { withPlatform } from "@/app/server/db/with-account";
import { createTestWorkspaceFixture } from "@/app/server/test-support";
import { auth } from "./server";
import { getSessionContext, setTestSessionContext } from "./session";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

describe("app/server/auth/session", () => {
  it("resolves live database session memberships and handles missing/banned sessions", async () => {
    const fixture = await createTestWorkspaceFixture({
      accountRole: "owner",
      platformRole: "superadmin",
    });

    const [createdSession] = await withPlatform((tx) =>
      tx
        .insert(authSessions)
        .values({
          activeAccountId: fixture.account.id,
          expiresAt: new Date(Date.now() + 3_600_000),
          token: `tok_${crypto.randomUUID()}`,
          userId: fixture.user.id,
        })
        .returning(),
    );

    setTestSessionContext(undefined);

    const spy = vi.spyOn(auth.api, "getSession");
    spy.mockResolvedValueOnce(null as never);
    expect(await getSessionContext()).toBeNull();

    spy.mockResolvedValueOnce({
      session: { id: crypto.randomUUID() },
      user: { id: crypto.randomUUID() },
    } as never);
    expect(await getSessionContext()).toBeNull();

    spy.mockResolvedValueOnce({
      session: { id: crypto.randomUUID() },
      user: { id: fixture.user.id },
    } as never);
    expect(await getSessionContext()).toBeNull();

    spy.mockResolvedValueOnce({
      session: { id: createdSession!.id },
      user: { id: fixture.user.id },
    } as never);
    const live = await getSessionContext();
    expect(live?.account?.id).toBe(fixture.account.id);
    expect(live?.accountRole).toBe("owner");

    spy.mockRestore();
  });
});
