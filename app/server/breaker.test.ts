import { describe, expect, it } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "./breaker";

describe("app/server/breaker", () => {
  it("opens after consecutive failures and recovers after cooldown", async () => {
    const breaker = new CircuitBreaker("dns", {
      failureThreshold: 2,
      cooldownMs: 1_000,
    });
    await expect(
      breaker.execute(async () => {
        throw new Error("boom");
      }, 100),
    ).rejects.toThrow("boom");
    expect(breaker.isOpen(100)).toBe(false);

    await expect(
      breaker.execute(async () => {
        throw new Error("boom");
      }, 200),
    ).rejects.toThrow("boom");
    expect(breaker.isOpen(250)).toBe(true);

    await expect(breaker.execute(async () => "ok", 300)).rejects.toBeInstanceOf(
      CircuitOpenError,
    );

    const recovered = await breaker.execute(async () => "ok", 1_500);
    expect(recovered).toBe("ok");
    expect(breaker.isOpen(1_500)).toBe(false);

    const defaultBreaker = new CircuitBreaker("defaults");
    expect(defaultBreaker.isOpen()).toBe(false);
    expect(await defaultBreaker.execute(async () => "live")).toBe("live");
  });
});
