import { VerifyResult } from "./types";
import { resolveCompany } from "./data/companies";
import { isOfficial } from "./domain";

export interface SearchProvider {
  search(query: string): Promise<{ title: string; url: string; snippet: string }[]>;
}

export class BraveSearchProvider implements SearchProvider {
  async search(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
    const apiKey = process.env.BRAVE_API_KEY;
    if (!apiKey) throw new Error("no search key");
    
    // In actual implementation, we'd fetch from Brave Search API.
    // Assuming this returns an array of objects for demonstration.
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
      headers: {
        "Accept": "application/json",
        "X-Subscription-Token": apiKey
      }
    });
    if (!res.ok) throw new Error("Search failed");
    const data = await res.json();
    
    return data.web?.results?.map((r: any) => ({
      title: r.title,
      url: r.url,
      snippet: r.description
    })) || [];
  }
}

export async function verifyRole(claims: any, provider: SearchProvider): Promise<VerifyResult> {
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
  
  // Try to search with the primary official domain
  const officialDomain = companyData.officialDomains[0];
  const query = `site:${officialDomain} "${role}"`;
  
  try {
    const results = await provider.search(query);
    
    // Evaluate results
    for (const res of results) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(res.url);
      } catch {
        continue;
      }
      
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
      
      if (matchedTokens / roleTokens.length >= 0.6) {
        return {
          claim: "role",
          status: "VERIFIED",
          evidence: "Role found on official site.",
          ruleId: "role.found",
          sources: [{ url: res.url, label: res.title }]
        };
      }
    }
    
    return {
      claim: "role",
      status: "UNCLEAR",
      evidence: "Not found in the sources we checked. Many real internships are not publicly listed.",
      ruleId: "role.not_found",
      sources: []
    };
    
  } catch (e: any) {
    if (e.message === "no search key") {
      return {
        claim: "role",
        status: "UNCLEAR",
        evidence: "role lookup unavailable (no search key)",
        ruleId: "role.no_api_key",
        sources: []
      };
    }
    return {
      claim: "role",
      status: "UNCLEAR",
      evidence: "Role check failed.",
      ruleId: "role.error",
      sources: []
    };
  }
}
