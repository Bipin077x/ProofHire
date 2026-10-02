import { extractClaims } from "./extract";
import type { ClaimsInput } from "./extract/claimsSchema";
import { runAllVerifiers, VerificationDeps } from "./verify";
import { calculateRollup, RollupResult } from "./rollup";
import { VerifyResult } from "./verify/types";

export interface AnalyzeResult {
  passport?: VerifyResult[];
  rollup?: RollupResult;
  extracted?: ClaimsInput;
  error?: string;
  status?: number;
}

export async function analyzePost(text: string, imageUrl?: string, deps?: VerificationDeps): Promise<AnalyzeResult> {
  let extracted: ClaimsInput;
  try {
    extracted = await extractClaims({ text, imageUrl }) as ClaimsInput;
  } catch (err: unknown) {
    const error = err as Error;
    return {
      error: "Extraction failed: " + (error.message || String(err)),
      status: 400
    };
  }

  if (!extracted.company) {
    const domains: string[] = [];
    if (extracted.emails && extracted.emails.length > 0) {
       for (const email of extracted.emails) {
         try {
           const parts = email.split('@');
           if (parts.length > 1) domains.push(parts[1]);
         } catch(e) {}
       }
    }
    if (extracted.urls && extracted.urls.length > 0) {
       for (const url of extracted.urls) {
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
         extracted.company = resolved.company.name;
       }
    }
  }

  // Use dummy provider if deps not passed
  const provider = deps || {
    searchProvider: {
      async search(query: string) { return []; }
    }
  };

  const passport = await runAllVerifiers(extracted, provider);
  const rollup = calculateRollup(passport);

  return {
    passport,
    rollup,
    extracted
  };
}
