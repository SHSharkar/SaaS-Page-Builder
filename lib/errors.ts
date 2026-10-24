export class AppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super("validation_failed", message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Sign in first.") {
    super("unauthorized", message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Your role does not permit this action.") {
    super("forbidden", message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super("not_found", message, 404);
  }
}

export class ConflictError extends AppError {
  readonly current?: unknown;

  constructor(message: string, current?: unknown) {
    super("conflict", message, 409);
    this.current = current;
  }
}

export class PayloadTooLargeError extends AppError {
  constructor(message = "The request payload exceeds the size limit.") {
    super("payload_too_large", message, 413);
  }
}

export class StepUpRequiredError extends AppError {
  constructor() {
    super(
      "step_up_required",
      "Confirm your password first. Sensitive changes require a recent verification.",
      428,
    );
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds = 60) {
    super("rate_limited", message, 429);
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
  }
}

export class LifecycleError extends AppError {
  readonly from: string;
  readonly to: string;

  constructor(entity: string, from: string, to: string, reason?: string) {
    super(
      "illegal_transition",
      reason ?? `Cannot move ${entity} from ${from} to ${to}.`,
      409,
    );
    this.from = from;
    this.to = to;
  }
}
