import { afterAll } from "vitest";

afterAll(async () => {
  const { closeDbPool } = await import("./app/server/db/client");
  const { closeRedisClient } = await import("./app/server/redis/client");
  await Promise.all([closeDbPool(), closeRedisClient()]);
});
