import { describe, expect, it } from "vitest";
import { z } from "zod";
import { firstFieldIssue, issuesFromZodError } from "./field-issues";

describe("lib/field-issues", () => {
  it("collects field and root issues from Zod errors", () => {
    const schema = z
      .object({ slug: z.string().min(3) })
      .refine((v) => v.slug !== "bad", { message: "Reserved slug" });
    const parsed = schema.safeParse({ slug: "a" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issues = issuesFromZodError(parsed.error);
      expect(firstFieldIssue(issues, "slug")).toBeTruthy();
      expect(firstFieldIssue(issues, "missing")).toBeNull();
    }
    const rootParsed = schema.safeParse({ slug: "bad" });
    if (!rootParsed.success) {
      const rootIssues = issuesFromZodError(rootParsed.error);
      expect(firstFieldIssue(rootIssues, "_form")).toBe("Reserved slug");
    }
  });
});
