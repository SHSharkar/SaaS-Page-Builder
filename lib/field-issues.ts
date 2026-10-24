import type { z } from "zod";

export type FieldIssues = Record<string, string[]>;

export function issuesFromZodError(error: z.ZodError): FieldIssues {
  const result: FieldIssues = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_form";
    const list = result[key] ?? [];
    list.push(issue.message);
    result[key] = list;
  }
  return result;
}

export function firstFieldIssue(
  issues: FieldIssues | undefined,
  field: string,
): string | null {
  const list = issues?.[field];
  return list && list.length > 0 ? (list[0] ?? null) : null;
}
