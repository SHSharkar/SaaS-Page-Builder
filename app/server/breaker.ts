import "server-only";

export interface BreakerOptions {
  readonly failureThreshold?: number;
  readonly cooldownMs?: number;
}

export class CircuitOpenError extends Error {
  constructor(name: string) {
    super(`Circuit breaker "${name}" is open`);
    this.name = "CircuitOpenError";
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;
  private readonly threshold: number;
  private readonly cooldownMs: number;

  constructor(
    private readonly name: string,
    options: BreakerOptions = {},
  ) {
    this.threshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30_000;
  }

  public isOpen(now = Date.now()): boolean {
    if (this.openedAt === null) {
      return false;
    }
    if (now - this.openedAt >= this.cooldownMs) {
      return false;
    }
    return true;
  }

  public async execute<T>(fn: () => Promise<T>, now = Date.now()): Promise<T> {
    if (this.isOpen(now)) {
      throw new CircuitOpenError(this.name);
    }
    try {
      const value = await fn();
      this.failures = 0;
      this.openedAt = null;
      return value;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.threshold) {
        this.openedAt = now;
      }
      throw error;
    }
  }
}
