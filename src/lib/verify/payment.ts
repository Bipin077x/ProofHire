import { VerifyResult } from "./types";

export function verifyPayment(claims: any): VerifyResult {
  const payment = claims.payment || {};
  
  if (!claims.transcript || claims.transcript.trim() === "") {
    return {
      claim: "payment",
      status: "UNCLEAR",
      evidence: "No transcript provided to analyze payment requests.",
      sources: [],
      nextAction: "Provide the original text to check for payment flags.",
      limitations: "Cannot verify without text.",
      ruleId: "payment.missing_text"
    };
  }

  if (payment.method) {
    // UPI requested
    return {
      claim: "payment",
      status: "RISK",
      evidence: `Payment via UPI requested (${payment.method}). Legitimate employers do not ask for UPI payments.`,
      sources: [],
      nextAction: "Do not send money.",
      limitations: "Automated UPI detection may occasionally flag support handles.",
      ruleId: "payment.upi_request"
    };
  }
  
  if (payment.requested) {
    const wording = payment.wording || "Found language requesting a fee or deposit.";
    return {
      claim: "payment",
      status: "RISK",
      evidence: wording + ". Legitimate employers do not charge candidates.",
      sources: [],
      nextAction: "Do not pay. Report this post.",
      limitations: "Matches keywords; check context if you believe this is a false positive.",
      ruleId: "payment.fee_wording"
    };
  }

  return {
    claim: "payment",
    status: "VERIFIED",
    evidence: "No fee wording or payment requests detected.",
    sources: [],
    nextAction: "Proceed carefully.",
    limitations: "Only the provided text was checked; never pay to get hired.",
    ruleId: "payment.no_fee"
  };
}
