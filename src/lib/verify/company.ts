import { VerifyResult } from "./types";
import { resolveCompany } from "./data/companies";
import { getHostFromEmailOrUrl, isOfficial } from "./domain";

export function verifyCompany(claims: any): VerifyResult {
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
      evidence: `Known brand (${company.name}) and contact/link matches official domains.`,
      sources: [{ label: "Careers Site", url: company.careersUrl }],
      nextAction: "Safe to engage.",
      limitations: "A real brand doesn't guarantee the specific role exists.",
      ruleId: "company.known_with_proof"
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
