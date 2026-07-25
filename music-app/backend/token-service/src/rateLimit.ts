/** A minimal fixed-window rate limiter. Dev/self-host only — production should use
 * a shared store (e.g. Redis) so limits hold across instances. */
export interface RateLimiter {
  /** Returns `retryAfter` seconds if blocked, or null if allowed. */
  check(key: string): number | null;
}

export class FixedWindowRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();
  constructor(
    private readonly limit: number,
    private readonly windowSeconds: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  check(key: string): number | null {
    const t = this.now();
    const entry = this.hits.get(key);
    if (!entry || t >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: t + this.windowSeconds * 1000 });
      return null;
    }
    if (entry.count >= this.limit) {
      return Math.ceil((entry.resetAt - t) / 1000);
    }
    entry.count += 1;
    return null;
  }
}

/** A limiter that never blocks (useful in tests). */
export const noopRateLimiter: RateLimiter = { check: () => null };
