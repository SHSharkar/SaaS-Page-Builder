import "server-only";
import { NextResponse } from "next/server";

export interface ProblemDetail {
  readonly type?: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
}

export function problemResponse(problem: ProblemDetail): NextResponse {
  return NextResponse.json(
    {
      type: problem.type ?? "about:blank",
      title: problem.title,
      status: problem.status,
      detail: problem.detail,
    },
    {
      status: problem.status,
      headers: {
        "content-type": "application/problem+json",
      },
    },
  );
}
