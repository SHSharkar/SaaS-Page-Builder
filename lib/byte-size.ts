const UNITS = ["B", "KB", "MB", "GB"] as const;

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    throw new Error("Invalid byte size");
  }
  if (bytes < 1024) {
    return `${Math.trunc(bytes)} B`;
  }
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${UNITS[unitIndex]}`;
}
