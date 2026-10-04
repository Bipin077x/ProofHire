import { VerifyResult } from "../verify/types";
import { getTemplate } from "../../content/copy";

export interface RollupResult {
  verdict: "HIGH_RISK" | "CAUTION" | "UNVERIFIED" | "NO_RED_FLAGS_FOUND";
  reasons: string[];
}

export function calculateRollup(results: VerifyResult[]): RollupResult {
  const formatReason = (r: VerifyResult) => {
    try {
      const template = getTemplate(r.ruleId);
      if (template && template.why) return template.why;
    } catch (e) {}
    const claimName = r.claim.charAt(0).toUpperCase() + r.claim.slice(1);
    return `${claimName}: ${r.evidence.toLowerCase()}`;
  };

  const paymentRes = results.find(r => r.claim === "payment");
  if (paymentRes?.ruleId === "payment.missing_text") {
    return { verdict: "UNVERIFIED", reasons: ["Transcript: no transcript provided to analyze."] };
  }

  const failedChecks = results.filter(r => r.ruleId === "system.check_failed");
  if (failedChecks.length > 0) {
    return { verdict: "UNVERIFIED", reasons: failedChecks.map(formatReason) };
  }

  const coreRiskResults = results.filter(r => r.status === "RISK" && r.claim !== "pressure");

  if (paymentRes?.status === "RISK") {
    return { verdict: "HIGH_RISK", reasons: coreRiskResults.map(formatReason) };
  }

  if (coreRiskResults.length >= 2) {
    return { verdict: "HIGH_RISK", reasons: coreRiskResults.map(formatReason) };
  }

  if (coreRiskResults.length === 1) {
    return { verdict: "CAUTION", reasons: [formatReason(coreRiskResults[0])] };
  }

  const reqClaims = ["payment", "company", "contact", "link"];
  const allReqVerified = reqClaims.every(c => {
    const res = results.find(r => r.claim === c);
    return res && res.status === "VERIFIED";
  });

  if (allReqVerified) {
    return { verdict: "NO_RED_FLAGS_FOUND", reasons: ["No explicit red flags were found in the provided claims."] };
  }

  const nonVerified = results.filter(r => r.status !== "VERIFIED" && r.status !== "RISK");
  if (nonVerified.length > 0) {
    return { verdict: "UNVERIFIED", reasons: nonVerified.map(formatReason) };
  }

  return { verdict: "UNVERIFIED", reasons: ["System: missing claims prevented verification."] };
}
