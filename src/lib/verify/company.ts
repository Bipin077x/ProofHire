import { VerifyResult } from "./types";
import { resolveCompany } from "./data/companies";
import { getHostFromEmailOrUrl, isOfficial } from "./domain";

interface CompanyClaims { company?: string; companySource?: "named_in_post" | "inferred_from_domain"; emails?: string[]; urls?: string[]; }

export function verifyCompany(claims: CompanyClaims): VerifyResult {
  const companyName = claims.company;
  if (!companyName) {
    return {
      claim: "company",
      status: "UNCLEAR",
      evidence: "No company name extracted.",
      sources: [],
      nextAction: "Ask for the company name.",
      limitations: "Cannot verify without a name.",
      ruleId: "company.missing"
    };
  }

  const { company } = resolveCompany(companyName);
  
  if (!company) {
    return {
      claim: "company",
      status: "UNCLEAR",
      evidence: `Unknown company: ${companyName}.`,
      sources: [],
      nextAction: "Research this company online.",
      limitations: "Our database only covers top employers.",
      ruleId: "company.unknown"
    };
  }

  const isInferred = claims.companySource === "inferred_from_domain";

  // Known brand - check if emails or links prove affiliation
  const emails = claims.emails || [];
  const urls = claims.urls || [];
  
  let hasProof = false;
  
  for (const email of emails) {
    const host = getHostFromEmailOrUrl(email);
    if (host && isOfficial(host, company.officialDomains)) {
      hasProof = true;
      break;
    }
  }
  
  if (!hasProof) {
    for (const url of urls) {
      const host = getHostFromEmailOrUrl(url);
      if (host && isOfficial(host, company.officialDomains)) {
        hasProof = true;
        break;
      }
    }
  }

  if (hasProof) {
    return {
      claim: "company",
      status: "VERIFIED",
      evidence: isInferred ? "Inferred from the official domain in the link; the post does not name the company." : "Named in the post.",
      sources: [{ label: "Careers Site", url: company.careersUrl }],
      nextAction: "No contradicting evidence found. Still verify through the company's official site.",
      limitations: "A real brand doesn't guarantee the specific role exists.",
      ruleId: isInferred ? "company.inferred" : "company.known_with_proof"
    };
  }

  return {
    claim: "company",
    status: "UNCLEAR",
    evidence: `Known brand (${company.name}); a real brand does not prove this post is real.`,
    sources: [{ label: "Careers Site", url: company.careersUrl }],
    nextAction: "Verify through official channels.",
    limitations: "Scammers frequently impersonate large brands.",
    ruleId: "company.known_without_proof"
  };
}
