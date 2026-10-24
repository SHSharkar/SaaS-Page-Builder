import "server-only";
import Redis from "ioredis";
import { RateLimitError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type LocalEntry = { raw: string; expiresAt: number };
type LocalCounter = { count: number; resetAt: number };

const LOCAL_MAX_ENTRIES = 2_000;
const localStore = new Map<string, LocalEntry>();
const localCounters = new Map<string, LocalCounter>();
const inFlight = new Map<string, Promise<unknown>>();

const globalValkey = globalThis as unknown as { __trofeoValkey?: Redis | null };

function safePart(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._:/@-]/g, "_")
      .slice(0, 200) || "root"
  );
}

export function valkeyUrl(): string | null {
  const configured = process.env.VALKEY_URL?.trim();
  return configured ? configured : null;
}

export function cacheBackend(): "valkey" | "memory" {
  return valkeyUrl() ? "valkey" : "memory";
}

function getValkeyClient(): Redis | null {
  const url = valkeyUrl();
  if (!url) return null;
  if (globalValkey.__trofeoValkey) return globalValkey.__trofeoValkey;

  const client = new Redis(url, {
    lazyConnect: true,
    connectTimeout: 1_500,
    commandTimeout: 1_500,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  client.on("error", (err) => {
    logger.warn({ err: err.message }, "Valkey client connection warning");
  });

  globalValkey.__trofeoValkey = client;
  return client;
}

async function ensureConnected(client: Redis): Promise<Redis> {
  if (client.status === "wait") {
    await client.connect();
  }
  return client;
}

function jitteredTtl(ttlSeconds: number): number {
  const base = Math.max(1, Math.floor(ttlSeconds));
  if (base < 10) return base;
  const spread = Math.min(120, Math.max(1, Math.floor(base * 0.08)));
  return base + Math.floor(Math.random() * spread);
}

export const cacheKeys = {
  host: (hostname: string) => `host:${safePart(hostname)}:v1`,
  domain: (hostname: string) => `host:${safePart(hostname)}:v1`,
  page: (siteId: string, slug: string) =>
    `site:${safePart(siteId)}:page:${safePart(slug || "__home__")}:v1`,
  pagePrefix: (siteId: string) => `site:${safePart(siteId)}:page:`,
  globals: (siteId: string) => `site:${safePart(siteId)}:globals:v1`,
  rateLimit: (scope: string, subject: string) => `rl:${safePart(scope)}:${safePart(subject)}:v1`,
};

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const client = getValkeyClient();
  if (client) {
    try {
      const ready = await ensureConnected(client);
      const raw = await ready.get(key);
      if (raw === null) return undefined;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.warn(
        { key, err: err instanceof Error ? err.message : String(err) },
        "Valkey read fallback",
      );
      return undefined;
    }
  }

  const entry = localStore.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    localStore.delete(key);
    return undefined;
  }
  return JSON.parse(entry.raw) as T;
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
  const ttl = jitteredTtl(ttlSeconds);
  const serialized = JSON.stringify(value);
  const client = getValkeyClient();
  if (client) {
    try {
      const ready = await ensureConnected(client);
      await ready.set(key, serialized, "EX", ttl);
    } catch (err) {
      logger.warn(
        { key, err: err instanceof Error ? err.message : String(err) },
        "Valkey write skipped",
      );
    }
    return;
  }

  if (localStore.size >= LOCAL_MAX_ENTRIES) {
    const oldest = localStore.keys().next().value;
    if (oldest !== undefined) localStore.delete(oldest);
  }
  localStore.set(key, { raw: serialized, expiresAt: Date.now() + ttl * 1_000 });
}

export async function cacheDel(...keys: string[]): Promise<void> {
  const valid = keys.filter(Boolean);
  if (valid.length === 0) return;

  const client = getValkeyClient();
  if (client) {
    try {
      const ready = await ensureConnected(client);
      await ready.unlink(...valid);
    } catch (err) {
      logger.warn(
        { keys: valid, err: err instanceof Error ? err.message : String(err) },
        "Valkey unlink failed",
      );
    }
  }

  for (const key of valid) {
    localStore.delete(key);
  }
}

export async function cacheDelPrefix(prefix: string): Promise<void> {
  const client = getValkeyClient();
  if (client) {
    try {
      const ready = await ensureConnected(client);
      let cursor = "0";
      do {
        const [nextCursor, found] = await ready.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = String(nextCursor);
        if (found.length > 0) {
          await ready.unlink(...found);
        }
      } while (cursor !== "0");
    } catch (err) {
      logger.warn(
        { prefix, err: err instanceof Error ? err.message : String(err) },
        "Valkey prefix scan failed",
      );
    }
  }

  for (const key of [...localStore.keys()]) {
    if (key.startsWith(prefix)) localStore.delete(key);
  }
}

export async function cacheClearAll(): Promise<void> {
  await Promise.all([
    cacheDelPrefix("host:"),
    cacheDelPrefix("site:"),
    cacheDel("cfg:platform:v1"),
  ]);
  localStore.clear();
}

export const cacheClear = cacheClearAll;

export async function cacheStats(): Promise<{ backend: "valkey" | "memory"; keys: number }> {
  const client = getValkeyClient();
  if (client) {
    try {
      const ready = await ensureConnected(client);
      const count = await ready.dbsize();
      return { backend: "valkey", keys: Number(count ?? 0) };
    } catch {
      return { backend: "valkey", keys: localStore.size };
    }
  }
  return { backend: "memory", keys: localStore.size };
}

export async function remember<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== undefined) return hit;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const task = (async () => {
    try {
      const fresh = await compute();
      await cacheSet(key, fresh, ttlSeconds);
      return fresh;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, task);
  return task;
}

export async function invalidateDomain(hostname: string): Promise<void> {
  await cacheDel(cacheKeys.host(hostname));
}

export async function invalidatePlatformConfig(): Promise<void> {
  await cacheDel("cfg:platform:v1");
}

export async function invalidatePageCache(
  siteId: string,
  slugs: string[],
  alsoHomepage = false,
): Promise<void> {
  const keys = slugs.flatMap((slug) => [
    cacheKeys.page(siteId, slug),
    cacheKeys.page(siteId, slug.replace(/^\/+/, "")),
  ]);
  if (alsoHomepage) {
    keys.push(
      cacheKeys.page(siteId, ""),
      cacheKeys.page(siteId, "/"),
      cacheKeys.page(siteId, "home"),
    );
  }
  await cacheDel(...keys);
}

export async function invalidatePage(siteId: string, slug: string): Promise<void> {
  await invalidatePageCache(siteId, [slug], slug === "/" || slug === "" || slug === "home");
}

export async function invalidateSiteCache(
  siteId: string,
  hostnames: string[] = [],
): Promise<void> {
  await Promise.all([
    cacheDelPrefix(cacheKeys.pagePrefix(siteId)),
    cacheDel(cacheKeys.globals(siteId), ...hostnames.map((host) => cacheKeys.host(host))),
  ]);
}

export const invalidateSite = invalidateSiteCache;

export interface RateLimitDecision {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeRateLimit(
  scopeAndSubject: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision>;
export async function consumeRateLimit(
  scope: string,
  subject: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitDecision>;
export async function consumeRateLimit(
  arg1: string,
  arg2: string | number,
  arg3: number,
  arg4?: number,
): Promise<RateLimitDecision> {
  let scope: string;
  let subject: string;
  let limit: number;
  let windowSeconds: number;

  if (typeof arg2 === "string") {
    scope = arg1;
    subject = arg2 || "anonymous";
    limit = arg3;
    windowSeconds = arg4 ?? 60;
  } else {
    const [head = "default", ...rest] = arg1.split(":");
    scope = head;
    subject = rest.join(":") || "anonymous";
    limit = arg2;
    windowSeconds = arg3;
  }

  const key = cacheKeys.rateLimit(scope, subject);
  const windowSec = Math.max(1, Math.floor(windowSeconds));

  const client = getValkeyClient();
  if (client) {
    try {
      const ready = await ensureConnected(client);
      const reply = await ready.multi().incr(key).expire(key, windowSec, "NX").ttl(key).exec();

      const count = Number(reply?.[0]?.[1] ?? 1);
      const ttl = Number(reply?.[2]?.[1] ?? windowSec);
      const retryAfterSeconds = ttl > 0 ? ttl : windowSec;
      return {
        allowed: count <= limit,
        count,
        remaining: Math.max(0, limit - count),
        retryAfterSeconds,
      };
    } catch (err) {
      logger.warn(
        { key, err: err instanceof Error ? err.message : String(err) },
        "Valkey rate-limit fallback",
      );
    }
  }

  const now = Date.now();
  const current = localCounters.get(key);
  if (!current || current.resetAt <= now) {
    localCounters.set(key, { count: 1, resetAt: now + windowSec * 1_000 });
    return {
      allowed: 1 <= limit,
      count: 1,
      remaining: Math.max(0, limit - 1),
      retryAfterSeconds: windowSec,
    };
  }
  current.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1_000));
  return {
    allowed: current.count <= limit,
    count: current.count,
    remaining: Math.max(0, limit - current.count),
    retryAfterSeconds,
  };
}

export async function enforceRateLimit(
  scopeAndSubject: string,
  limit: number,
  windowSeconds: number,
  message: string,
): Promise<void> {
  const decision = await consumeRateLimit(scopeAndSubject, limit, windowSeconds);
  if (!decision.allowed) {
    throw new RateLimitError(message, decision.retryAfterSeconds);
  }
}
