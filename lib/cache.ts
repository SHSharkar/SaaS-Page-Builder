
type Entry = { value: unknown; expiresAt: number };

const store = new Map<string, Entry>();

const DEFAULT_TTL_MS = 5 * 60_000;

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(...keys: string[]): number {
  let removed = 0;
  for (const key of keys) if (store.delete(key)) removed += 1;
  return removed;
}

export function cacheDeletePrefix(prefix: string): number {
  let removed = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed += 1;
    }
  }
  return removed;
}

export function cacheClear(): void {
  store.clear();
}

export const cacheKeys = {
  domain: (hostname: string) => `dom:${hostname}`,
  page: (siteId: string, path: string, versionId: string) => `page:${siteId}:${path}:${versionId}`,
  pagePrefix: (siteId: string) => `page:${siteId}:`,
  globals: (siteId: string) => `site:${siteId}:globals`,
  config: () => "cfg:platform",
  rate: (scope: string, window: string) => `rl:${scope}:${window}`,
};

export function invalidatePageCache(siteId: string): number {
  return cacheDeletePrefix(cacheKeys.pagePrefix(siteId));
}

export function invalidateGlobals(siteId: string): number {
  return cacheDelete(cacheKeys.globals(siteId)) + invalidatePageCache(siteId);
}

export function invalidateDomain(hostname: string): number {
  return cacheDelete(cacheKeys.domain(hostname));
}

export function invalidateSite(siteId: string, hostnames: string[] = []): number {
  let removed = invalidatePageCache(siteId) + cacheDelete(cacheKeys.globals(siteId));
  for (const hostname of hostnames) removed += invalidateDomain(hostname);
  return removed;
}

export function consumeRateLimit(scope: string, limit: number, windowSeconds: number): boolean {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = cacheKeys.rate(scope, String(bucket));
  const current = cacheGet<number>(key) ?? 0;
  if (current >= limit) return false;
  cacheSet(key, current + 1, windowSeconds * 1000);
  return true;
}

export function cacheStats(): { keys: number; hitRateNote: string } {
  return { keys: store.size, hitRateNote: "in-process store; one instance in this build" };
}
