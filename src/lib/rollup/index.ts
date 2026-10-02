import { VerifyResult } from "../verify/types";

export interface RollupResult {
  verdict: "HIGH_RISK" | "CAUTION" | "UNVERIFIED" | "NO_RED_FLAGS_FOUND";
  reasons: string[];
}

export function calculateRollup(results: VerifyResult[]): RollupResult {
  // Rule 1: transcriptEmpty -> UNVERIFIED
  const paymentRes = results.find(r => r.claim === "payment");
  if (paymentRes?.ruleId === "payment.missing_text") {
    return { verdict: "UNVERIFIED", reasons: ["No transcript provided to analyze."] };
  }

  // Rule 5: any system.check_failed -> UNVERIFIED
  if (results.some(r => r.ruleId === "system.check_failed")) {
    return { verdict: "UNVERIFIED", reasons: ["One or more verification checks failed to execute."] };
  }

  // Count RISK across core claims
  const coreRiskResults = results.filter(r => r.status === "RISK" && r.claim !== "pressure");

  // Rule 2: payment RISK -> HIGH_RISK
  if (paymentRes?.status === "RISK") {
    return { verdict: "HIGH_RISK", reasons: [paymentRes.evidence] };
  }

  // Rule 3: >= 2 RISK among core claims -> HIGH_RISK
  if (coreRiskResults.length >= 2) {
    return { verdict: "HIGH_RISK", reasons: coreRiskResults.map(r => r.evidence) };
  }

  // Rule 4: exactly 1 RISK (which is not payment, since that would hit Rule 2) -> CAUTION
  if (coreRiskResults.length === 1) {
    return { verdict: "CAUTION", reasons: [coreRiskResults[0].evidence] };
  }

  // Rule 6: NO_RED_FLAGS_FOUND only if payment, company, contact AND link are all VERIFIED
  const reqClaims = ["payment", "company", "contact", "link"];
  const allReqVerified = reqClaims.every(c => {
    const res = results.find(r => r.claim === c);
    return res && res.status === "VERIFIED";
  });

  if (allReqVerified) {
    return { verdict: "NO_RED_FLAGS_FOUND", reasons: ["No explicit red flags were found in the provided claims."] };
  }

  // fallback
  return { verdict: "UNVERIFIED", reasons: ["Could not independently verify all core claims."] };
}
