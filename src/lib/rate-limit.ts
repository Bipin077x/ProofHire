export interface RateLimiter {
  consume(ip: string): Promise<{ allowed: boolean; retryAfter?: number }>;
}

export class InMemoryRateLimiter implements RateLimiter {
  private buckets = new Map<string, { tokens: number; lastRefill: number }>();
  private readonly maxTokens = 10;
  private readonly refillRate = 10; // tokens per minute
  private readonly refillInterval = 60000; // 1 minute in ms

  constructor(private readonly getNow: () => number = Date.now) {}

  async consume(ip: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const now = this.getNow();
    let bucket = this.buckets.get(ip);
    
    if (!bucket) {
      bucket = { tokens: this.maxTokens, lastRefill: now };
      this.buckets.set(ip, bucket);
    } else {
      const timePassed = now - bucket.lastRefill;
      if (timePassed >= this.refillInterval) {
        const tokensToAdd = Math.floor(timePassed / this.refillInterval) * this.refillRate;
        bucket.tokens = Math.min(this.maxTokens, bucket.tokens + tokensToAdd);
        bucket.lastRefill = now;
      }
    }

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      return { allowed: true };
    } else {
      const msUntilRefill = this.refillInterval - (now - bucket.lastRefill);
      return { allowed: false, retryAfter: Math.ceil(msUntilRefill / 1000) };
    }
  }
}
