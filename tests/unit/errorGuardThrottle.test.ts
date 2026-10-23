import { describe, expect, it } from 'vitest';
import { CircuitBreaker, RingBuffer, TokenBucket } from '@shared/errorGuard/throttle';

describe('TokenBucket', () => {
  it('starts full and refuses when empty', () => {
    const bucket = new TokenBucket(3, 1, 0);
    expect(bucket.tryTake(1, 0)).toBe(true);
    expect(bucket.tryTake(1, 0)).toBe(true);
    expect(bucket.tryTake(1, 0)).toBe(true);
    expect(bucket.tryTake(1, 0)).toBe(false);
  });

  it('refills over time and never exceeds capacity', () => {
    const bucket = new TokenBucket(2, 1, 0);
    bucket.tryTake(2, 0);
    expect(bucket.tryTake(1, 500)).toBe(false);
    expect(bucket.tryTake(1, 1_000)).toBe(true);
    expect(bucket.available(60_000)).toBe(2);
  });

  it('lets a storm through at the configured rate, not faster', () => {
    const bucket = new TokenBucket(10, 10, 0); // 10/s
    let allowed = 0;
    for (let i = 0; i < 1_000; i++) {
      if (bucket.tryTake(1, i * 10)) allowed += 1; // 100 requests per second
    }
    // 10 burst + ~10/s refill over 10 seconds.
    expect(allowed).toBeGreaterThanOrEqual(10);
    expect(allowed).toBeLessThanOrEqual(110);
  });
});

describe('CircuitBreaker', () => {
  it('stays closed below the threshold', () => {
    const breaker = new CircuitBreaker(3, 1_000);
    breaker.recordFailure(0);
    breaker.recordFailure(0);
    expect(breaker.canAttempt(0)).toBe(true);
    expect(breaker.isOpen).toBe(false);
  });

  it('opens after the threshold and blocks until the cooldown', () => {
    const breaker = new CircuitBreaker(2, 1_000);
    breaker.recordFailure(0);
    breaker.recordFailure(0);
    expect(breaker.isOpen).toBe(true);
    expect(breaker.canAttempt(500)).toBe(false);
    expect(breaker.canAttempt(1_001)).toBe(true);
  });

  it('resets after a success', () => {
    const breaker = new CircuitBreaker(1, 1_000);
    breaker.recordFailure(0);
    expect(breaker.isOpen).toBe(true);
    breaker.recordSuccess();
    expect(breaker.isOpen).toBe(false);
    expect(breaker.canAttempt(0)).toBe(true);
  });
});

describe('RingBuffer', () => {
  it('keeps the newest items and counts what it dropped', () => {
    const buffer = new RingBuffer<number>(3);
    [1, 2, 3, 4, 5].forEach((value) => buffer.push(value));
    expect(buffer.size).toBe(3);
    expect(buffer.dropped).toBe(2);
    expect(buffer.drain()).toEqual([3, 4, 5]);
    expect(buffer.size).toBe(0);
  });
});
