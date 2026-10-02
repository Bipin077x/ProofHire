import { VerifyResult } from "./types";

const NEGATIONS = ["no", "not", "never", "without", "free of", "zero"];
const FEE_PHRASES = ["fee", "charge", "deposit", "money", "kit charge", "registration"];
const AMOUNT_FEE_REGEX = /(?:₹|rs\.?|inr)\s*[\d,]+|\b(?:fee|charge|confirm seat|book)\b/i;

interface PaymentClaims {
  transcript?: string;
  payment?: { requested?: boolean; method?: string; wording?: string };
}

export function verifyPayment(claims: PaymentClaims): VerifyResult {
  const transcript = claims.transcript || "";
  
  if (!transcript.trim()) {
    return {
      claim: "payment",
      status: "UNCLEAR",
      evidence: "No transcript provided to analyze payment requests.",
      sources: [],
      nextAction: "Provide the original text to check for payment flags.",
      ruleId: "payment.missing_text"
    };
  }

  // Split into sentences first
  const sentences = transcript.split(/[.!?\n]+/);

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    
    // Check for payment imperatives followed by amount/fee in the same sentence
    const impMatch = sentence.match(/\b(pay|send|transfer|deposit|remit|scan|upi)\b/i);
    if (impMatch) {
      const restOfSentence = sentence.slice(impMatch.index! + impMatch[0].length);
      if (AMOUNT_FEE_REGEX.test(restOfSentence)) {
        return {
          claim: "payment",
          status: "RISK",
          evidence: `Found payment imperative followed by fee/amount in sentence: "${sentence.trim()}"`,
          sources: [],
          nextAction: "Do not pay. Report this post.",
          ruleId: "payment.imperative_match"
        };
      }
    }
    
    // Simplified robust logic for clause parsing:
    const clauses = sentence.split(/[,;]|(?:\b(?:but|however|except)\b)/i);
    
    for (const clause of clauses) {
      if (!clause.trim()) continue;
      
      const lowerClause = clause.toLowerCase();
      
      // Does clause contain a fee phrase?
      let feeIndex = -1;
      let matchedFee = "";
      for (const f of FEE_PHRASES) {
        const idx = lowerClause.indexOf(f);
        if (idx !== -1) {
          feeIndex = idx;
          matchedFee = f;
          break;
        }
      }
      
      if (feeIndex !== -1) {
        // Find negation before it within 6 tokens
        const beforeFee = clause.slice(0, feeIndex).trim();
        if (beforeFee) {
          const tokensBefore = beforeFee.split(/\s+/);
          const lastTokens = tokensBefore.slice(-6); // up to 6 tokens before
          
          let negated = false;
          const textToSearch = lastTokens.join(" ").toLowerCase();
          for (const n of NEGATIONS) {
            // Need to match word boundary for negations like 'no'
            if (new RegExp(`\\b${n}\\b`).test(textToSearch)) {
              negated = true;
              break;
            }
          }
          
          if (!negated) {
            return {
              claim: "payment",
              status: "RISK",
              evidence: `Found fee phrase "${matchedFee}" without immediate preceding negation.`,
              sources: [],
              nextAction: "Do not pay. Report this post.",
              ruleId: "payment.fee_wording"
            };
          }
        } else {
           // No words before fee phrase, so not negated
           return {
              claim: "payment",
              status: "RISK",
              evidence: `Found fee phrase "${matchedFee}" without immediate preceding negation.`,
              sources: [],
              nextAction: "Do not pay. Report this post.",
              ruleId: "payment.fee_wording"
            };
        }
      }
    }
  }

  // Fallback to claims.payment.method (UPI) if extracted by regex overall
  if (claims.payment?.method) {
    return {
      claim: "payment",
      status: "RISK",
      evidence: `Payment via UPI requested (${claims.payment.method}).`,
      sources: [],
      nextAction: "Do not send money.",
      ruleId: "payment.upi_request"
    };
  }

  return {
    claim: "payment",
    status: "VERIFIED",
    evidence: "No fee wording or payment requests detected.",
    sources: [],
    nextAction: "Proceed carefully.",
    ruleId: "payment.no_fee"
  };
}
