import "server-only";

export function isUniqueViolation(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== "object" || depth > 3) {
    return false;
  }
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23505") {
    return true;
  }
  return isUniqueViolation(candidate.cause, depth + 1);
}
