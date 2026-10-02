import { VerifyResult } from "../verify/types";

export interface RollupResult {
  riskLevel: "HIGH" | "CAUTION" | "UNVERIFIED" | "NO_FLAGS";
  reasons: string[];
}

export function calculateRollup(results: VerifyResult[]): RollupResult {
  const riskResults = results.filter(r => r.status === "RISK");
  if (riskResults.length > 0) {
    return {
      riskLevel: "HIGH",
      reasons: riskResults.map(r => r.evidence)
    };
  }

  const companyResult = results.find(r => r.claim === "company");
  const contactResult = results.find(r => r.claim === "contact");
  
  const companyUnverified = !companyResult || companyResult.status === "NOT_VERIFIED" || companyResult.status === "UNCLEAR";
  const contactUnverified = !contactResult || contactResult.status === "NOT_VERIFIED" || contactResult.status === "UNCLEAR";
  
  const mismatchOrUnresolved = results.some(r => r.status === "UNCLEAR" && (r.ruleId.endsWith(".mismatch") || r.ruleId.endsWith(".unresolved")));

  if ((companyUnverified && contactUnverified) || mismatchOrUnresolved) {
    const reasons: string[] = [];
    if (companyUnverified && contactUnverified) reasons.push("Core identity (company and contact) could not be verified.");
    if (mismatchOrUnresolved) reasons.push("There are unresolved claims or mismatches in the provided data.");
    return {
      riskLevel: "CAUTION",
      reasons
    };
  }

  const notVerifiedCount = results.filter(r => r.status === "NOT_VERIFIED").length;
  if (notVerifiedCount >= 3) {
    return {
      riskLevel: "UNVERIFIED",
      reasons: ["Too many claims lacked sufficient evidence for verification."]
    };
  }

  return {
    riskLevel: "NO_FLAGS",
    reasons: ["No explicit scam indicators or high-risk mismatches were detected."]
  };
}
