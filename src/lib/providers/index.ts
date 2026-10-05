import { TavilyClient, CacheStore, CreditStore } from "./tavily";
import { SearchProvider, BraveSearchProvider, SearchResult } from "../verify/role";

export class TavilySearchProvider implements SearchProvider {
  constructor(private client: TavilyClient) {}

  async search(query: string, includeDomains?: string[]): Promise<{ ok: true; results: SearchResult[] } | { ok: false; reason: string }> {
    const res = await this.client.search(query, includeDomains);
    if (!res.ok) {
      if (res.reason === "unavailable" && !process.env.TAVILY_API_KEY) {
        return { ok: false, reason: "no search key" };
      }
      return { ok: false, reason: res.reason };
    }
    const mapped = res.data.results.map(r => ({
      title: r.title,
      url: r.url,
      snippet: r.content
    }));
    return { ok: true, results: mapped };
  }
}

// In-memory cache for simplicity; tests can inject
export class MemoryCache implements CacheStore {
  private store = new Map<string, { value: string; expiry: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    this.store.set(key, { value, expiry: Date.now() + ttlMs });
  }
}

export class MemoryCreditStore implements CreditStore {
  private usage = new Map<string, number>();

  async getDailyUsage(dateStr: string): Promise<number> {
    return this.usage.get(dateStr) || 0;
  }

  async incrementDailyUsage(dateStr: string, amount: number): Promise<void> {
    const current = this.usage.get(dateStr) || 0;
    this.usage.set(dateStr, current + amount);
  }
}

export const globalCache = new MemoryCache();
export const globalCreditStore = new MemoryCreditStore();

export type PageProviderReason = "blocked_unsafe" | "unreadable" | "login_wall" | "provider_unavailable" | "rate_limited" | "cap_reached";

export interface PageProvider {
  fetchPage(url: string): Promise<{ ok: true; finalUrl: string; text: string } | { ok: false; reason: PageProviderReason }>;
}

export class TavilyPageProvider implements PageProvider {
  constructor(
    private client: TavilyClient, 
    private resolveUrl: (url: string) => Promise<import("../safe-fetch").SafeFetchResult>
  ) {}

  async fetchPage(url: string): Promise<{ ok: true; finalUrl: string; text: string } | { ok: false; reason: PageProviderReason }> {
    // a) run the existing safeResolve on the link
    const resolveResult = await this.resolveUrl(url);
    if (resolveResult.error || resolveResult.blocked || !resolveResult.finalUrl) {
      return { ok: false, reason: "blocked_unsafe" };
    }
    const finalUrl = resolveResult.finalUrl;
    
    // b) only if the final URL host is not an IP literal, not localhost/private, scheme http/https and has no credentials
    let parsed: URL;
    try {
      parsed = new URL(finalUrl);
    } catch {
      return { ok: false, reason: "unreadable" };
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { ok: false, reason: "unreadable" };
    if (parsed.username || parsed.password) return { ok: false, reason: "unreadable" };
    
    const host = parsed.hostname.toLowerCase();
    // basic check for IP/localhost
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || host === "localhost" || host.endsWith(".local")) {
      return { ok: false, reason: "unreadable" };
    }

    // "never form/chat hosts (forms.gle, docs.google.com/forms, wa.me, t.me, linktr.ee)"
    if (
      host === "forms.gle" || 
      (host === "docs.google.com" && parsed.pathname.startsWith("/forms")) ||
      host === "wa.me" || 
      host === "t.me" || 
      host === "linktr.ee"
    ) {
      return { ok: false, reason: "unreadable" };
    }

    // send finalUrl to Tavily Extract
    const res = await this.client.extract(finalUrl);
    if (!res.ok) {
      if (res.reason === "cap_reached") return { ok: false, reason: "cap_reached" };
      if (res.reason === "rate_limited") return { ok: false, reason: "rate_limited" };
      return { ok: false, reason: "provider_unavailable" };
    }

    const { results, failed_results } = res.data;
    if (failed_results && failed_results.some(f => f.url === finalUrl)) {
      return { ok: false, reason: "unreadable" };
    }

    const match = results.find(r => r.url === finalUrl);
    if (!match || !match.raw_content) {
      return { ok: false, reason: "unreadable" };
    }

    let text = match.raw_content.trim();
    if (text.length < 200) {
      return { ok: false, reason: "unreadable" }; // short JS-only
    }
    
    // cap at 20k chars
    if (text.length > 20000) {
      text = text.substring(0, 20000);
    }

    return { ok: true, finalUrl, text };
  }
}

export function getSearchProvider(customFetch?: typeof fetch): SearchProvider {
  const providerType = process.env.SEARCH_PROVIDER || (process.env.TAVILY_API_KEY ? "tavily" : "brave");
  if (providerType === "tavily") {
    const client = new TavilyClient({
      cache: globalCache,
      creditStore: globalCreditStore,
      customFetch
    });
    return new TavilySearchProvider(client);
  }
  return new BraveSearchProvider();
}

export function getPageProvider(
  resolveUrl: (url: string) => Promise<import("../safe-fetch").SafeFetchResult>,
  customFetch?: typeof fetch
): PageProvider {
  const providerType = process.env.PAGE_PROVIDER || (process.env.TAVILY_API_KEY ? "tavily" : "none");
  
  if (providerType === "tavily") {
    const client = new TavilyClient({
      cache: globalCache,
      creditStore: globalCreditStore,
      customFetch
    });
    return new TavilyPageProvider(client, resolveUrl);
  }

  return {
    async fetchPage() {
      return { ok: false, reason: "provider_unavailable" };
    }
  };
}
