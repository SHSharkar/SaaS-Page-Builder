import { AppError, RateLimitError } from "./errors";

const STATUS_TITLES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  413: "Content Too Large",
  422: "Unprocessable Content",
  428: "Precondition Required",
  429: "Too Many Requests",
  500: "Internal Server Error",
};

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  instance?: string;
}

export interface DirectProblemInput {
  status: number;
  title?: string;
  detail: string;
  code?: string;
  instance?: string;
  requestId?: string;
  headers?: Record<string, string>;
}

function isDirectProblemInput(value: unknown): value is DirectProblemInput {
  return (
    typeof value === "object" &&
    value !== null &&
    !(value instanceof Error) &&
    typeof (value as { status?: unknown }).status === "number" &&
    typeof (value as { detail?: unknown }).detail === "string"
  );
}

export function problemResponse(
  errorOrSpec: unknown,
  options?: {
    instance?: string;
    fallbackMessage?: string;
    fallbackStatus?: number;
    requestId?: string;
    extraHeaders?: Record<string, string>;
  },
): Response {
  if (isDirectProblemInput(errorOrSpec)) {
    const status = errorOrSpec.status;
    const code =
      errorOrSpec.code ??
      (STATUS_TITLES[status] ?? "error").toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const body: ProblemDetails = {
      type: `https://trofeo.pages/problems/${code.replace(/_/g, "-")}`,
      title: errorOrSpec.title ?? STATUS_TITLES[status] ?? "Error",
      status,
      detail: errorOrSpec.detail,
      code,
      ...(errorOrSpec.instance ? { instance: errorOrSpec.instance } : {}),
    };
    const rid = errorOrSpec.requestId ?? options?.requestId ?? globalThis.crypto.randomUUID();
    const headers: Record<string, string> = {
      "Content-Type": "application/problem+json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Request-Id": rid,
      ...(errorOrSpec.headers ?? {}),
      ...(options?.extraHeaders ?? {}),
    };
    return new Response(JSON.stringify(body), { status, headers });
  }

  const appError =
    errorOrSpec instanceof AppError
      ? errorOrSpec
      : new AppError(
          "request_failed",
          errorOrSpec instanceof Error
            ? errorOrSpec.message
            : (options?.fallbackMessage ?? "Request failed."),
          options?.fallbackStatus ?? 400,
        );

  const status = appError.status;
  const body: ProblemDetails = {
    type: `https://trofeo.pages/problems/${appError.code.replace(/_/g, "-")}`,
    title: STATUS_TITLES[status] ?? "Error",
    status,
    detail: appError.message,
    code: appError.code,
    ...(options?.instance ? { instance: options.instance } : {}),
  };

  const rid = options?.requestId ?? globalThis.crypto.randomUUID();
  const headers: Record<string, string> = {
    "Content-Type": "application/problem+json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Request-Id": rid,
    ...(options?.extraHeaders ?? {}),
  };
  if (appError instanceof RateLimitError) {
    headers["Retry-After"] = String(appError.retryAfterSeconds);
  }

  return new Response(JSON.stringify(body), { status, headers });
}

export function problemFromError(error: unknown, requestId?: string): Response {
  return problemResponse(error, { requestId });
}

export function methodNotAllowed(allowed: string[], requestId?: string): Response {
  const rid = requestId ?? globalThis.crypto.randomUUID();
  return problemResponse(
    new AppError(
      "method_not_allowed",
      `Method not allowed. Supported methods: ${allowed.join(", ")}.`,
      405,
    ),
    {
      requestId: rid,
      extraHeaders: { Allow: allowed.join(", ") },
    },
  );
}
