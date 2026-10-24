import "server-only";
import Redis from "ioredis";
import { getEnv } from "@/app/server/env";
import { logger } from "@/app/server/logger";

const globalRedis = globalThis as unknown as {
  __spbValkeyClient?: Redis | null;
};

export function getRedisClient(): Redis {
  if (globalRedis.__spbValkeyClient) {
    return globalRedis.__spbValkeyClient;
  }
  const { REDIS_URL } = getEnv();
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 2,
    connectTimeout: 3_000,
    commandTimeout: 3_000,
    lazyConnect: false,
  });
  client.on("error", (err) => {
    logger.warn({ err: err.message }, "Valkey client error");
  });
  globalRedis.__spbValkeyClient = client;
  return client;
}

export async function closeRedisClient(): Promise<void> {
  const client = globalRedis.__spbValkeyClient;
  globalRedis.__spbValkeyClient = null;
  if (client) {
    await client.quit().catch(() => {
      client.disconnect();
    });
  }
}

export async function valkeyPing(): Promise<boolean> {
  const pong = await getRedisClient().ping();
  return pong === "PONG";
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await getRedisClient().get(key);
  if (raw === null) {
    return null;
  }
  return JSON.parse(raw) as T;
}

export async function cacheSetJson<T>(
  key: string,
  value: T,
  ttlSeconds: number,
): Promise<void> {
  const ttl = Math.max(1, Math.trunc(ttlSeconds));
  await getRedisClient().set(key, JSON.stringify(value), "EX", ttl);
}

export async function cacheDelKeys(...keys: string[]): Promise<void> {
  if (keys.length === 0) {
    return;
  }
  await getRedisClient().del(...keys);
}

export async function consumeSlidingBudget(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const client = getRedisClient();
  const count = await client.incr(key);
  if (count === 1) {
    await client.expire(key, Math.max(1, Math.trunc(windowSeconds)));
  }
  return {
    allowed: count <= limit,
    remaining: Math.max(0, limit - count),
  };
}
