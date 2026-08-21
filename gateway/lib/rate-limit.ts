// Per-IP fixed-window rate limiter.
//
// Provides a per-IP quota with a burst allowance. Non-exempt paths consume
// tokens. The store is a plain Map with lazy window expiry; it is deliberately
// not a globally shared singleton so tests and multi-instance deployments stay
// isolated.

export class RateLimiter {
  private readonly buckets = new Map<string, { count: number; windowStart: number }>();
  private readonly perMin: number;
  private readonly burst: number;

  constructor(perMin: number, burst: number) {
    this.perMin = perMin;
    this.burst = burst;
  }

  private now(): number {
    return Date.now();
  }

  /**
   * Try to take one token for `key`. Returns `true` when allowed, or a
   * `Retry-After`-compatible seconds value (false-like guard) when denied.
   */
  allow(key: string): true | number {
    const windowMs = 60_000;
    const capacity = Math.max(this.perMin, this.burst);
    const now = this.now();

    const bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= windowMs) {
      // Fresh window: allow up to burst.
      this.buckets.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (bucket.count >= capacity) {
      const retryAfterSecs = Math.ceil((bucket.windowStart + windowMs - now) / 1000);
      return Math.max(1, retryAfterSecs);
    }

    bucket.count += 1;
    return true;
  }

  /** Drop expired buckets so the Map can't grow unboundedly. */
  sweep(now = this.now()): void {
    const cutoff = now - 60_000;
    for (const [key, bucket] of this.buckets) {
      if (bucket.windowStart < cutoff) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
