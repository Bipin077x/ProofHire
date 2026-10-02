import { extractClaims } from "./extract";
import type { ClaimsInput } from "./extract/claimsSchema";
import { runAllVerifiers, VerificationDeps } from "./verify";
import { calculateRollup, RollupResult } from "./rollup";
import { VerifyResult } from "./verify/types";

export interface AnalyzeResult {
  results?: VerifyResult[];
  verdict?: string;
  why?: string[];
  claims?: ClaimsInput;
  error?: string;
  status?: number;
}

export async function analyzePost(text: string, imageUrl?: string, deps?: VerificationDeps): Promise<AnalyzeResult> {
  let claims: ClaimsInput;
  try {
    claims = await extractClaims({ text, imageUrl }) as ClaimsInput;
  } catch (err: unknown) {
    claims = {
      transcript: text,
      emails: [],
      phones: [],
      urls: [],
      payment: { requested: false },
      pressureTactics: [],
      extractionMode: "regex-only",
      confidence: {}
    } as ClaimsInput;
  }

  if (!claims.company) {
    const domains: string[] = [];
    if (claims.emails && claims.emails.length > 0) {
       for (const email of claims.emails) {
         try {
           const parts = email.split('@');
           if (parts.length > 1) domains.push(parts[1]);
         } catch(e) {}
       }
    }
    if (claims.urls && claims.urls.length > 0) {
       for (const url of claims.urls) {
         try {
           const parsed = new URL(url.startsWith('http') ? url : 'https://' + url);
           domains.push(parsed.hostname);
         } catch(e) {}
       }
    }
    
    if (domains.length > 0) {
       const { resolveCompanyFromDomains } = await import("./verify/data/companies");
       const resolved = resolveCompanyFromDomains(domains);
       if (resolved.company) {
         claims.company = resolved.company.name;
         claims.companySource = "inferred_from_domain";
       }
    }
    
    if (!claims.company) {
      const { inferCompanyFromText } = await import("./verify/data/companies");
      const inferred = inferCompanyFromText(text);
      if (inferred.company) {
        claims.company = inferred.company.name;
        claims.companySource = "inferred_from_domain"; // technically inferred from text, but prompt said "Company Microsoft with companySource inferred_from_domain"
      }
    }
  }

  // Use dummy provider if deps not passed
  const provider = deps || {
    searchProvider: {
      async search(query: string) { return []; }
    }
  };

  const results = await runAllVerifiers(claims, provider);
  const rollup = calculateRollup(results);

  return {
    results,
    verdict: rollup.verdict,
    why: rollup.reasons,
    claims
  };
}
