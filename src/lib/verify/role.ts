import { VerifyResult } from "./types";
import { resolveCompany } from "./data/companies";
import { isOfficial } from "./domain";

export type SearchResult = { title: string; url: string; snippet: string };

export interface SearchProvider {
  search(query: string, includeDomains?: string[]): Promise<{ ok: true; results: SearchResult[] } | { ok: false; reason: string }>;
}

export class BraveSearchProvider implements SearchProvider {
  constructor(private customFetch: typeof fetch = fetch) {}

  async search(query: string, includeDomains?: string[]): Promise<{ ok: true; results: SearchResult[] } | { ok: false; reason: string }> {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) return { ok: false, reason: "no search key" };
    
    // Brave doesn't support an array of includeDomains natively in the API body like Tavily, 
    // so we append it to the query if provided
    let finalQuery = query;
    if (includeDomains && includeDomains.length > 0) {
      finalQuery += ` site:${includeDomains[0]}`;
    }

    try {
      const res = await this.customFetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(finalQuery)}`, {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": apiKey
        }
      });
      if (!res.ok) return { ok: false, reason: "unavailable" };
      const data = await res.json();
      
      const results = data.web?.results?.map((r: { title: string; url: string; description: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.description
      })) || [];
      return { ok: true, results };
    } catch {
      return { ok: false, reason: "unavailable" };
    }
  }
}

export async function verifyRole(claims: { role?: string; company?: string }, provider: SearchProvider): Promise<VerifyResult> {
  const role = claims.role;
  const companyName = claims.company;
  
  if (!role) {
    return { claim: "role", status: "UNCLEAR", evidence: "No role provided.", ruleId: "role.missing", sources: [] };
  }
  
  if (!companyName) {
    return { claim: "role", status: "UNCLEAR", evidence: "Company unknown.", ruleId: "role.unknown_company", sources: [] };
  }
  
  const companyData = resolveCompany(companyName).company;
  if (!companyData || !companyData.officialDomains || companyData.officialDomains.length === 0) {
    return { claim: "role", status: "UNCLEAR", evidence: "no official domain known", ruleId: "role.no_official_domain", sources: [] };
  }
  
  // Prompt: "Query contains ONLY company name and role title"
  const query = `${companyName} ${role}`;
  
  try {
    const searchRes = await provider.search(query, companyData.officialDomains);
    if (!searchRes.ok) {
      if (searchRes.reason === "no search key") {
        return {
          claim: "role",
          status: "UNCLEAR",
          evidence: "role lookup unavailable (no search key)",
          ruleId: "role.no_api_key",
          sources: []
        };
      }
      // Prompt: "provider failure -> UNCLEAR check failed"
      return {
        claim: "role",
        status: "UNCLEAR",
        evidence: "check failed",
        ruleId: "role.error",
        sources: []
      };
    }

    const results = searchRes.results;
    
    // Evaluate results
    for (const res of results) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(res.url);
      } catch {
        continue;
      }
      
      // Prompt: "re-check every result host with isOfficial and drop the rest"
      if (!isOfficial(parsedUrl.hostname, companyData.officialDomains)) {
        continue;
      }
      
      const roleTokens = role.toLowerCase().split(/\W+/).filter((t: string) => t.length > 2);
      if (roleTokens.length === 0) continue;
      
      const searchContent = (res.title + " " + res.snippet).toLowerCase();
      
      let matchedTokens = 0;
      for (const token of roleTokens) {
        if (searchContent.includes(token)) {
          matchedTokens++;
        }
      }
      
      // Prompt: "match -> VERIFIED with the URL as a source (source.kind 'search_result')"
      if (matchedTokens / roleTokens.length >= 0.6) {
        return {
          claim: "role",
          status: "VERIFIED",
          evidence: "Role found on official site.",
          ruleId: "role.found",
          sources: [{ url: res.url, label: res.title, kind: "search_result" }]
        };
      }
    }
    
    // Prompt: "no match -> UNCLEAR with the existing 'Not found in the sources we checked' text"
    return {
      claim: "role",
      status: "UNCLEAR",
      evidence: "Not found in the sources we checked. Many real internships are not publicly listed.",
      ruleId: "role.not_found",
      sources: []
    };
    
  } catch (e: unknown) {
    return {
      claim: "role",
      status: "UNCLEAR",
      evidence: "check failed",
      ruleId: "role.error",
      sources: []
    };
  }
}
