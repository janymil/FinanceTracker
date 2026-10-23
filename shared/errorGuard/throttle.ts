/**
 * Backpressure primitives (blueprint 07 §6).
 *
 * Pure and injectable-clock on purpose: the storm test and the unit tests both need to
 * simulate minutes of traffic in microseconds, and a buggy tracker must never be able
 * to take the app down with it.
 */

/** Classic token bucket. `tryTake` never throws and never waits. */
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    now: number = Date.now(),
  ) {
    this.tokens = capacity;
    this.lastRefill = now;
  }

  tryTake(cost = 1, now: number = Date.now()): boolean {
    this.refill(now);
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }

  available(now: number = Date.now()): number {
    this.refill(now);
    return Math.floor(this.tokens);
  }

  private refill(now: number): void {
    const elapsedSeconds = Math.max(0, (now - this.lastRefill) / 1000);
    if (elapsedSeconds <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillPerSecond);
    this.lastRefill = now;
  }
}

/**
 * Circuit breaker for the database write path: after `failureThreshold` consecutive
 * failures, writes stop for `cooldownMs` so a sick database is not hammered by the
 * error reporter.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;

  constructor(
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 60_000,
  ) {}

  canAttempt(now: number = Date.now()): boolean {
    if (this.failures < this.failureThreshold) return true;
    if (now - this.openedAt >= this.cooldownMs) {
      // Half-open: allow one probe. A failure re-opens it immediately.
      this.failures = this.failureThreshold - 1;
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = 0;
  }

  recordFailure(now: number = Date.now()): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.openedAt = now;
  }

  get isOpen(): boolean {
    return this.failures >= this.failureThreshold;
  }

  get failureCount(): number {
    return this.failures;
  }
}

/** Bounded queue: keeps the newest, counts what it had to throw away. */
export class RingBuffer<T> {
  private items: T[] = [];
  private droppedCount = 0;

  constructor(private readonly capacity: number) {}

  push(item: T): void {
    this.items.push(item);
    while (this.items.length > this.capacity) {
      this.items.shift();
      this.droppedCount += 1;
    }
  }

  drain(): T[] {
    const drained = this.items;
    this.items = [];
    return drained;
  }

  get size(): number {
    return this.items.length;
  }

  get dropped(): number {
    return this.droppedCount;
  }
}
