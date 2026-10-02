import { VerifyResult } from "./types";
import { resolveCompany } from "./data/companies";
import { getHostFromEmailOrUrl, isLookalike, isOfficial } from "./domain";

const FREE_MAIL_PROVIDERS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "proton.me", "rediffmail.com", "ymail.com"];

export function verifyContact(claims: any): VerifyResult {
  const companyName = claims.company || "";
  const emails = claims.emails || [];
  const phones = claims.phones || [];
  
  if (emails.length === 0 && phones.length === 0) {
    return {
      claim: "contact",
      status: "UNCLEAR",
      evidence: "No contact info provided.",
      sources: [],
      nextAction: "Verify contact methods.",
      limitations: "Unable to verify without email or phone.",
      ruleId: "contact.missing"
    };
  }

  const { company } = resolveCompany(companyName);
  
  // If we have an email to check
  if (emails.length > 0) {
    const email = emails[0];
    const host = getHostFromEmailOrUrl(email);
    
    if (host) {
      if (company && company.officialDomains) {
        if (isOfficial(host, company.officialDomains)) {
          return {
            claim: "contact",
            status: "VERIFIED",
            evidence: `Email domain matches official domain for ${company.name}.`,
            sources: [{ label: "Official Site", url: company.careersUrl }],
            nextAction: "Safe to contact.",
            limitations: "Email spoofing is still technically possible, but rare in basic scams.",
            ruleId: "contact.email_official"
          };
        }
        
        if (FREE_MAIL_PROVIDERS.includes(host)) {
          return {
            claim: "contact",
            status: "RISK",
            evidence: `Free email (${host}) claiming to represent ${company.name}.`,
            sources: [{ label: "Manual verification", url: "https://www.linkedin.com/search/results/companies/?keywords=" + encodeURIComponent(company.name) }],
            nextAction: "Avoid contact. Real companies use official domains.",
            limitations: "Very small companies might use free emails, but this rule applies to known brands.",
            ruleId: "contact.freemail_known_brand"
          };
        }
        
        if (isLookalike(host, company.officialDomains)) {
          return {
            claim: "contact",
            status: "RISK",
            evidence: `Email domain (${host}) is a lookalike of official domains.`,
            sources: [],
            nextAction: "Do not contact. Likely a phishing attempt.",
            limitations: "Similarity checks may have false positives.",
            ruleId: "contact.email_lookalike"
          };
        }
      }
      
      // If we don't know the company
      if (!company) {
        return {
          claim: "contact",
          status: "UNCLEAR",
          evidence: `Email provided (${host}), but company is unknown.`,
          sources: [],
          nextAction: "Manually verify the company and domain.",
          limitations: "Domain age and reputation checks are needed.",
          ruleId: "contact.unknown_company"
        };
      }
    }
  }

  // If only phone/WhatsApp
  if (phones.length > 0) {
    return {
      claim: "contact",
      status: "UNCLEAR",
      evidence: "Only phone/WhatsApp contact provided.",
      sources: [],
      nextAction: "Check Truecaller or official company pages.",
      limitations: "Phone numbers cannot be definitively linked to a company offline.",
      ruleId: "contact.phone_only"
    };
  }
  
  return {
    claim: "contact",
    status: "UNCLEAR",
    evidence: "Contact information could not be verified.",
    sources: [],
    nextAction: "Verify contact methods manually.",
    limitations: "Insufficient data.",
    ruleId: "contact.unclear"
  };
}
