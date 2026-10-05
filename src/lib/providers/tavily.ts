import { z } from "zod";

const SearchResponseSchema = z.object({
  query: z.string().optional(),
  answer: z.string().nullable().optional(),
  results: z.array(z.object({
    title: z.string(),
    url: z.string(),
    content: z.string(),
    score: z.number().optional(),
    raw_content: z.string().nullable().optional()
  })),
  response_time: z.number().optional()
});

const ExtractResponseSchema = z.object({
  results: z.array(z.object({
    url: z.string(),
    raw_content: z.string().nullable()
  })),
  failed_results: z.array(z.object({
    url: z.string(),
    error: z.string()
  })).optional()
});

export type TavilySearchResponse = z.infer<typeof SearchResponseSchema>;
export type TavilyExtractResponse = z.infer<typeof ExtractResponseSchema>;

export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
}

export interface CreditStore {
  getDailyUsage(dateStr: string): Promise<number>;
  incrementDailyUsage(dateStr: string, amount: number): Promise<void>;
}

export type TavilyErrorReason = "unavailable" | "rate_limited" | "timeout" | "bad_response" | "cap_reached" | "circuit_open";

export type Result<T> = { ok: true; data: T } | { ok: false; reason: TavilyErrorReason };

export class TavilyClient {
  private apiKey: string;
  private cap: number;
  private cache: CacheStore;
  private creditStore: CreditStore;
  private customFetch: typeof fetch;

  private consecutiveFailures = 0;
  private circuitOpenUntil = 0;

  constructor(opts: {
    apiKey?: string;
    dailyCap?: number;
    cache: CacheStore;
    creditStore: CreditStore;
    customFetch?: typeof fetch;
  }) {
    this.apiKey = opts.apiKey || process.env.TAVILY_API_KEY || "";
    this.cap = opts.dailyCap ?? parseInt(process.env.TAVILY_DAILY_CREDIT_CAP || "200", 10);
    this.cache = opts.cache;
    this.creditStore = opts.creditStore;
    this.customFetch = opts.customFetch || fetch;
  }

  private getDateStr() {
    return new Date().toISOString().split("T")[0];
  }

  private async checkCircuitAndCap(cost: number): Promise<Result<null>> {
    if (Date.now() < this.circuitOpenUntil) {
      return { ok: false, reason: "circuit_open" };
    }

    const today = this.getDateStr();
    const used = await this.creditStore.getDailyUsage(today);
    if (used + cost > this.cap) {
      return { ok: false, reason: "cap_reached" };
    }
    return { ok: true, data: null };
  }

  private recordFailure(status?: number) {
    this.consecutiveFailures++;
    if (this.consecutiveFailures >= 3) {
      this.circuitOpenUntil = Date.now() + 60000;
    }
  }

  private recordSuccess() {
    this.consecutiveFailures = 0;
    this.circuitOpenUntil = 0;
  }

  async search(query: string, includeDomains?: string[]): Promise<Result<TavilySearchResponse>> {
    if (!this.apiKey) return { ok: false, reason: "unavailable" };

    const cacheKey = `tavily:search:${query}:${includeDomains?.join(",") || ""}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return { ok: true, data: SearchResponseSchema.parse(JSON.parse(cached)) };
      } catch (e) {
        // ignore bad cache
      }
    }

    const check = await this.checkCircuitAndCap(1);
    if (!check.ok) return check;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      // We use include_domains if available, though docs might use include_domains
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const body: any = {
        api_key: this.apiKey,
        query,
        search_depth: "basic",
      };
      if (includeDomains && includeDomains.length > 0) {
        body.include_domains = includeDomains;
      }

      const res = await this.customFetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        this.recordFailure(429);
        return { ok: false, reason: "rate_limited" };
      }
      if (!res.ok) {
        this.recordFailure(res.status);
        return { ok: false, reason: "unavailable" };
      }

      const json = await res.json();
      const parsed = SearchResponseSchema.safeParse(json);
      if (!parsed.success) {
        this.recordFailure();
        return { ok: false, reason: "bad_response" };
      }

      this.recordSuccess();
      await this.creditStore.incrementDailyUsage(this.getDateStr(), 1);
      await this.cache.set(cacheKey, JSON.stringify(parsed.data), 24 * 60 * 60 * 1000);

      return { ok: true, data: parsed.data };
    } catch (e: unknown) {
      this.recordFailure();
      const err = e as Error;
      if (err.name === "AbortError") {
        return { ok: false, reason: "timeout" };
      }
      return { ok: false, reason: "unavailable" };
    }
  }

  async extract(url: string): Promise<Result<TavilyExtractResponse>> {
    if (!this.apiKey) return { ok: false, reason: "unavailable" };

    const cacheKey = `tavily:extract:${url}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return { ok: true, data: ExtractResponseSchema.parse(JSON.parse(cached)) };
      } catch (e) {
        // ignore
      }
    }

    const check = await this.checkCircuitAndCap(0.2);
    if (!check.ok) return check;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await this.customFetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: this.apiKey,
          urls: [url],
          extract_depth: "basic",
          format: "markdown"
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.status === 429) {
        this.recordFailure(429);
        return { ok: false, reason: "rate_limited" };
      }
      if (!res.ok) {
        this.recordFailure(res.status);
        return { ok: false, reason: "unavailable" };
      }

      const text = await res.text();
      if (text.length > 5 * 1024 * 1024) { 
         return { ok: false, reason: "bad_response" };
      }
      const json = JSON.parse(text);
      const parsed = ExtractResponseSchema.safeParse(json);
      if (!parsed.success) {
        this.recordFailure();
        return { ok: false, reason: "bad_response" };
      }

      this.recordSuccess();
      await this.creditStore.incrementDailyUsage(this.getDateStr(), 0.2);
      await this.cache.set(cacheKey, JSON.stringify(parsed.data), 24 * 60 * 60 * 1000);

      return { ok: true, data: parsed.data };
    } catch (e: unknown) {
      this.recordFailure();
      const err = e as Error;
      if (err.name === "AbortError") {
        return { ok: false, reason: "timeout" };
      }
      return { ok: false, reason: "unavailable" };
    }
  }
}
