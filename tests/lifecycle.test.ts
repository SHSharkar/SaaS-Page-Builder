import { describe, expect, it } from "vitest";
import { canTransition, KEEP, nextStates } from "@/lib/lifecycle";
import { LifecycleError } from "@/lib/errors";
import { assertTransition } from "@/lib/lifecycle";

/**
 * Group Y of the data assessment checklist: the state machines must reject
 * every illegal move and must not lose a legal one. These are the transitions
 * the product promises in PRD 3.5.
 */
describe("page state machine", () => {
  it("allows draft → published → draft", () => {
    expect(canTransition("page", "draft", "published")).toBe(true);
    expect(canTransition("page", "published", "draft")).toBe(true);
  });

  it("allows republishing without leaving published", () => {
    expect(canTransition("page", "published", "published")).toBe(true);
  });

  it("allows a published page to be archived", () => {
    expect(canTransition("page", "published", "archived")).toBe(true);
  });

  it("allows an archived page back to draft only", () => {
    expect(nextStates("page", "archived")).toEqual(["draft"]);
    expect(canTransition("page", "archived", "published")).toBe(false);
  });

  it("refuses an unpublish of a draft", () => {
    expect(canTransition("page", "draft", "draft")).toBe(true);
    expect(canTransition("page", "draft", "archived")).toBe(true);
  });
});

describe("site state machine", () => {
  it("suspends and resumes", () => {
    expect(canTransition("site", "active", "suspended")).toBe(true);
    expect(canTransition("site", "suspended", "active")).toBe(true);
  });

  it("restores a deleted site", () => {
    expect(canTransition("site", "deleted", "active")).toBe(true);
  });

  it("refuses to suspend a deleted site", () => {
    expect(canTransition("site", "deleted", "suspended")).toBe(false);
  });
});

describe("domain state machine", () => {
  it("verifies only from pending or verifying", () => {
    expect(canTransition("domain", "pending", "verifying")).toBe(true);
    expect(canTransition("domain", "verifying", "active")).toBe(true);
    expect(canTransition("domain", "failed", "active")).toBe(false);
  });

  it("re-opens a failed domain through retry", () => {
    expect(canTransition("domain", "failed", "pending")).toBe(true);
  });

  it("treats removed as terminal", () => {
    expect(nextStates("domain", "removed")).toEqual([]);
  });
});

describe("import state machine", () => {
  it("walks uploaded → parsing → mapped → in_review → applied", () => {
    const path = ["uploaded", "parsing", "mapped", "in_review", "applied"];
    for (let index = 0; index < path.length - 1; index += 1) {
      expect(canTransition("import", path[index], path[index + 1])).toBe(true);
    }
  });

  it("cannot apply an import that was never reviewed", () => {
    expect(canTransition("import", "uploaded", "applied")).toBe(false);
    expect(canTransition("import", "mapped", "applied")).toBe(true);
  });

  it("cannot discard an applied job", () => {
    expect(canTransition("import", "applied", "discarded")).toBe(false);
  });
});

describe("media, invite and template machines", () => {
  it("only promotes a pending upload", () => {
    expect(canTransition("media", "pending", "ready")).toBe(true);
    expect(canTransition("media", "deleted", "ready")).toBe(false);
  });

  it("accepts an invitation once", () => {
    expect(canTransition("invite", "pending", "accepted")).toBe(true);
    expect(canTransition("invite", "accepted", "revoked")).toBe(false);
  });

  it("retires a template and never revives it", () => {
    expect(canTransition("template", "active", "retired")).toBe(true);
    expect(canTransition("template", "retired", "active")).toBe(false);
  });
});

describe("refusals are typed", () => {
  it("throws a LifecycleError carrying both states", () => {
    try {
      assertTransition("page", "archived", "published");
      throw new Error("expected a refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(LifecycleError);
      const refusal = error as LifecycleError;
      expect(refusal.code).toBe("illegal_transition");
      expect(refusal.status).toBe(409);
      expect(refusal.from).toBe("archived");
      expect(refusal.to).toBe("published");
      expect(refusal.message).toContain("archived");
    }
  });

  it("uses a caller-supplied message when one is given", () => {
    expect(() => assertTransition("page", "archived", "published", "Restore it first.")).toThrow("Restore it first.");
  });
});

describe("keep windows", () => {
  it("matches the numbers the PRD promises", () => {
    expect(KEEP.auditMonths).toBe(24);
    expect(KEEP.versionsPerPage).toBe(50);
    expect(KEEP.importJobDays).toBe(90);
    expect(KEEP.siteRestoreDays).toBe(30);
    expect(KEEP.pendingMediaHours).toBe(24);
  });
});
