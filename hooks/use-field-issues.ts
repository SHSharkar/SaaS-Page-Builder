"use client";

import { useMemo } from "react";
import { firstFieldIssue, type FieldIssues } from "@/lib/field-issues";

export function useFieldIssues(issues: FieldIssues | undefined) {
  return useMemo(
    () => ({
      issueFor: (field: string) => firstFieldIssue(issues, field),
      formIssue: firstFieldIssue(issues, "_form"),
    }),
    [issues],
  );
}
