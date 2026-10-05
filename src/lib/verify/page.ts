import { VerifyResult } from "./types";
import { PageProvider } from "../providers";
import type { ClaimsInput } from "../extract/claimsSchema";
import { resolveCompany } from "./data/companies";

export async function verifyPage(claims: ClaimsInput, provider?: PageProvider): Promise<VerifyResult> {
  if (!claims.urls || claims.urls.length === 0) {
    return {
      claim: "page",
      status: "UNCLEAR",
      evidence: "No link provided.",
      ruleId: "page.missing_link",
      sources: []
    };
  }

  if (!provider) {
    return {
      claim: "page",
      status: "UNCLEAR",
      evidence: "The page content could not be read; this does not mean the link is unsafe.",
      ruleId: "page.unreadable",
      sources: []
    };
  }

  const targetUrl = claims.urls[0];
  const pageRes = await provider.fetchPage(targetUrl);

  if (!pageRes.ok) {
    return {
      claim: "page",
      status: "UNCLEAR",
      evidence: "The page content could not be read; this does not mean the link is unsafe.",
      ruleId: "page.unreadable",
      sources: [{ url: targetUrl, label: "Page Link" }]
    };
  }

  const text = pageRes.text.toLowerCase();
  
  // Sensitive info check
  const sensitiveLabels = ["aadhaar", "pan", "bank account", "ifsc", "otp", "card number", "cvv", "selfie with id"];
  const requestVerbs = ["enter", "provide", "upload", "submit", "send", "give"];
  
  const matchedSensitive = [];
  for (const label of sensitiveLabels) {
    if (text.includes(label)) {
      const idx = text.indexOf(label);
      const snippet = text.substring(Math.max(0, idx - 40), Math.min(text.length, idx + 40));
      if (requestVerbs.some(v => snippet.includes(v))) {
        matchedSensitive.push(label);
      }
    }
  }

  if (matchedSensitive.length > 0) {
    const labels = matchedSensitive.slice(0, 5).join(", ");
    const snippetIdx = text.indexOf(matchedSensitive[0]);
    let excerpt = text.substring(Math.max(0, snippetIdx - 20), Math.min(text.length, snippetIdx + 40)).replace(/\s+/g, " ").trim();
    if (excerpt.length > 60) excerpt = excerpt.substring(0, 57) + "...";
    
    return {
      claim: "page",
      status: "RISK",
      evidence: `Requested: ${labels}. Excerpt: "${excerpt}"`,
      ruleId: "page.sensitive_request",
      sources: [{ url: pageRes.finalUrl, label: "Extracted Page Content" }]
    };
  }

  // Payment check
  const feeWording = ["processing fee", "security deposit", "onboarding fee", "registration fee", "scan to pay"];
  const paymentDomains = ["razorpay.com", "paytm.com", "phonepe.com", "payu.in", "ccavenue.com", "instamojo.com", "cashfree.com"];
  const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/;
  
  let isPaymentRisk = false;
  let paymentExcerpt = "";
  
  for (const word of feeWording) {
    if (text.includes(word)) {
      isPaymentRisk = true;
      const idx = text.indexOf(word);
      paymentExcerpt = text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + 40)).replace(/\s+/g, " ").trim();
      break;
    }
  }

  if (!isPaymentRisk) {
    for (const pd of paymentDomains) {
      if (text.includes(pd)) {
        isPaymentRisk = true;
        const idx = text.indexOf(pd);
        paymentExcerpt = text.substring(Math.max(0, idx - 20), Math.min(text.length, idx + 40)).replace(/\s+/g, " ").trim();
        break;
      }
    }
  }

  if (!isPaymentRisk) {
    const match = text.match(upiRegex);
    if (match) {
      const upi = match[0];
      if (upi.endsWith("@ybl") || upi.endsWith("@upi") || upi.endsWith("@okaxis") || upi.endsWith("@okicici") || upi.endsWith("@paytm") || upi.endsWith("@sbi")) {
        isPaymentRisk = true;
        paymentExcerpt = upi;
      }
    }
  }

  if (isPaymentRisk) {
    if (paymentExcerpt.length > 60) paymentExcerpt = paymentExcerpt.substring(0, 57) + "...";
    return {
      claim: "page",
      status: "RISK",
      evidence: `Payment request detected. Excerpt: "${paymentExcerpt}"`,
      ruleId: "page.payment_request",
      sources: [{ url: pageRes.finalUrl, label: "Extracted Page Content" }]
    };
  }

  // Official Domain + Role tokens check
  if (claims.company && claims.role) {
    const companyData = resolveCompany(claims.company).company;
    if (companyData && companyData.officialDomains && companyData.officialDomains.length > 0) {
      let parsed: URL | null = null;
      try {
        parsed = new URL(pageRes.finalUrl);
      } catch (e) {}

      if (parsed) {
        const isOfficialDomain = companyData.officialDomains.some(d => parsed!.hostname === d || parsed!.hostname.endsWith("." + d));
        
        if (isOfficialDomain) {
          const roleTokens = claims.role.toLowerCase().split(/\W+/).filter(t => t.length > 2);
          if (roleTokens.length > 0) {
            let matchedTokens = 0;
            for (const token of roleTokens) {
              if (text.includes(token)) matchedTokens++;
            }
            if (matchedTokens / roleTokens.length >= 0.6) {
               return {
                  claim: "page",
                  status: "VERIFIED",
                  evidence: "Role found on official page.",
                  ruleId: "page.role_listed_official",
                  sources: [{ url: pageRes.finalUrl, label: "Official Page" }]
               };
            } else {
               // Mismatch
               return {
                  claim: "page",
                  status: "UNCLEAR",
                  evidence: "The page content does not match the expected company or role details.",
                  ruleId: "page.mismatch",
                  sources: [{ url: pageRes.finalUrl, label: "Official Page" }]
               };
            }
          }
        }
      }
    }
  }

  return {
    claim: "page",
    status: "UNCLEAR",
    evidence: "No specific risks found, but could not fully verify.",
    ruleId: "fallback",
    sources: [{ url: pageRes.finalUrl, label: "Page Link" }]
  };
}
