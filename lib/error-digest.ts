export function extractErrorDigest(error: unknown): string | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const candidate = (error as { digest?: unknown }).digest;
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : null;
}
