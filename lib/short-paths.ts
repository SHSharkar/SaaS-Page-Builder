export const SHORT_CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz";
export const SHORT_CODE_LENGTH = 28;
export const SHORT_CODE_PATTERN = /^[a-z]{28}$/;
export const SCAN_SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

export function generateShortCode(): string {
  const output: string[] = [];
  const limit =
    Math.floor(256 / SHORT_CODE_ALPHABET.length) * SHORT_CODE_ALPHABET.length;
  while (output.length < SHORT_CODE_LENGTH) {
    const bytes = new Uint8Array(64);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte < limit && output.length < SHORT_CODE_LENGTH) {
        const ch = SHORT_CODE_ALPHABET[byte % SHORT_CODE_ALPHABET.length];
        if (ch) {
          output.push(ch);
        }
      }
    }
  }
  return output.join("");
}

export function isValidShortCode(code: string): boolean {
  return SHORT_CODE_PATTERN.test(code);
}

export function isValidScanSegment(segment: string): boolean {
  return SCAN_SEGMENT_PATTERN.test(segment);
}

export function goShortPath(code: string): string {
  if (!isValidShortCode(code)) {
    throw new Error("Invalid short code format");
  }
  return `/go/${code}`;
}

export function scanSharePath(segment: string): string {
  if (!isValidScanSegment(segment)) {
    throw new Error("Invalid scan segment format");
  }
  return `/scan/${segment}`;
}

export function isShortLinkPathname(pathname: string): boolean {
  return pathname.startsWith("/go/") || pathname.startsWith("/scan/");
}
