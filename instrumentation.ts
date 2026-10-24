export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapEnv } = await import("@/app/server/bootstrap-env");
    bootstrapEnv();
  }
}

export async function onRequestError(
  error: { digest?: string } & Error,
  request: { path: string; method: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logger } = await import("@/app/server/logger");
    logger.error(
      {
        digest: error.digest ?? "unknown",
        errorMessage: error.message,
        method: request.method,
        path: request.path,
      },
      "request.unhandled_error",
    );
  }
}
