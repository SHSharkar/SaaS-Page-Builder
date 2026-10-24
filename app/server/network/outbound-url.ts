import "server-only";
import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_IPV4_RANGES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 255],
  [10, 0, 255],
  [100, 64, 127],
  [127, 0, 255],
  [169, 254, 254],
  [172, 16, 31],
  [192, 168, 168],
];

function isBlockedIpv4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map((n) => Number(n));
  if (a >= 224) {
    return true;
  }
  return BLOCKED_IPV4_RANGES.some(
    ([first, minSecond, maxSecond]) =>
      a === first && b >= minSecond && b <= maxSecond,
  );
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") {
    return true;
  }
  if (
    lower.startsWith("fc") ||
    lower.startsWith("fd") ||
    lower.startsWith("fe80")
  ) {
    return true;
  }
  if (lower.startsWith("::ffff:")) {
    return isBlockedIpv4(lower.slice(7));
  }
  return false;
}

export function isBlockedIpAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return isBlockedIpv4(ip);
  }
  if (family === 6) {
    return isBlockedIpv6(ip);
  }
  return true;
}

export async function assertSafeOutboundUrl(rawUrl: string): Promise<{
  url: URL;
  pinnedAddresses: string[];
}> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Outbound URL must use HTTP or HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Outbound URL cannot contain embedded credentials");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal")
  ) {
    throw new Error("Blocked internal hostname");
  }
  if (net.isIP(host) !== 0) {
    if (isBlockedIpAddress(host)) {
      throw new Error("Blocked private or loopback IP address");
    }
    return { url: parsed, pinnedAddresses: [host] };
  }
  const records = await dns.lookup(host, { all: true });
  if (records.length === 0) {
    throw new Error("Unable to resolve outbound hostname");
  }
  for (const record of records) {
    if (isBlockedIpAddress(record.address)) {
      throw new Error("Resolved hostname points to a blocked IP range");
    }
  }
  return {
    url: parsed,
    pinnedAddresses: records.map((r) => r.address),
  };
}
