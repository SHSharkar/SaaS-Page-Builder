/**
 * A typed refusal. The state machines in `lib/lifecycle.ts` raise this when a
 * move is not on the map, so a caller can tell "you asked for something this
 * record cannot do" from "the write failed". The message is safe to show to
 * staff; the code is stable enough for a client to branch on.
 */
export type LifecycleKind = "page" | "domain" | "import" | "media" | "invite" | "site" | "template" | "session";

export class LifecycleError extends Error {
  readonly code = "illegal_transition" as const;
  readonly status = 409;
  readonly kind: LifecycleKind;
  readonly from: string;
  readonly to: string;

  constructor(kind: LifecycleKind, from: string, to: string, message?: string) {
    super(message ?? `A ${kind} cannot move from “${from}” to “${to}”.`);
    this.name = "LifecycleError";
    this.kind = kind;
    this.from = from;
    this.to = to;
  }
}

export class NotFoundError extends Error {
  readonly code = "not_found" as const;
  readonly status = 404;
  constructor(subject: string) {
    super(`${subject} was not found.`);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly code = "conflict" as const;
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export function isLifecycleError(error: unknown): error is LifecycleError {
  return error instanceof LifecycleError;
}
