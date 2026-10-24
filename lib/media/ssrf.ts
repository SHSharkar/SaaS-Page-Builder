import "server-only";
import { promises as dns } from "node:dns";
import net from "node:net";

function ipv4IsPrivate(ip: string): boolean {
  const parts = ip.split(".").map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function ipv6IsPrivate(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("::ffff:")) {
    const tail = normalized.slice(7);
    if (net.isIPv4(tail)) return ipv4IsPrivate(tail);
    return true;
  }
  return false;
}

export function isPrivateIpAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return ipv4IsPrivate(ip);
  if (family === 6) return ipv6IsPrivate(ip);
  return true;
}

export function isSafeRemoteUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return false;
  }
  if (net.isIP(host)) {
    return !isPrivateIpAddress(host);
  }
  return true;
}

export async function assertSafeResolvedUrl(raw: string): Promise<URL | null> {
  if (!isSafeRemoteUrl(raw)) return null;
  const url = new URL(raw);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    return isPrivateIpAddress(host) ? null : url;
  }
  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (records.length === 0) return null;
    for (const record of records) {
      if (isPrivateIpAddress(record.address)) {
        return null;
      }
    }
    return url;
  } catch {
    return null;
  }
}

export async function safeFetchBytes(
  rawUrl: string,
  maxBytes: number,
  maxRedirects = 3,
): Promise<Buffer | null> {
  let currentUrl = rawUrl;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const checked = await assertSafeResolvedUrl(currentUrl);
    if (!checked) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(checked.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: { accept: "image/*" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop === maxRedirects) return null;
        currentUrl = new URL(location, checked).toString();
        continue;
      }

      if (!response.ok || !response.body) return null;
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > maxBytes) return null;

      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return null;
        }
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks, total);
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
