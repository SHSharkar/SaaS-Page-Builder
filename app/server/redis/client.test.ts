import { describe, expect, it } from "vitest";
import {
  cacheDelKeys,
  cacheGetJson,
  cacheSetJson,
  consumeSlidingBudget,
  valkeyPing,
} from "./client";

describe("app/server/redis/client", () => {
  it("stores, reads, deletes, and rate-limits solely through Valkey", async () => {
    expect(await valkeyPing()).toBe(true);
    const key = `test:cache:${crypto.randomUUID()}`;
    await cacheSetJson(key, { ready: true }, 30);
    expect(await cacheGetJson<{ ready: boolean }>(key)).toEqual({
      ready: true,
    });
    await cacheDelKeys(key);
    expect(await cacheGetJson(key)).toBeNull();

    const budgetKey = `test:budget:${crypto.randomUUID()}`;
    const first = await consumeSlidingBudget(budgetKey, 2, 30);
    const second = await consumeSlidingBudget(budgetKey, 2, 30);
    const third = await consumeSlidingBudget(budgetKey, 2, 30);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    await cacheDelKeys(budgetKey);
  });
});
