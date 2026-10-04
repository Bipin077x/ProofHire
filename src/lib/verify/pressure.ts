import { VerifyResult } from "./types";

import { PRESSURE_PATTERNS } from "../extract/regex";

interface PressureClaims { transcript?: string; pressureTactics?: string[]; }

export function verifyPressure(claims: PressureClaims): VerifyResult {
  const foundPhrases: string[] = [];
  
  const text = claims.transcript ? claims.transcript : "";
  
  if (!text) {
    return {
      claim: "pressure",
      status: "UNCLEAR",
      evidence: "No transcript to analyze.",
      sources: [],
      nextAction: "Provide original text.",
      limitations: "Cannot verify without text.",
      ruleId: "pressure.missing_text"
    };
  }

  // Check extracted tactics from LLM if present
  if (claims.pressureTactics && Array.isArray(claims.pressureTactics)) {
    for (const tactic of claims.pressureTactics) {
      if (!foundPhrases.includes(tactic)) {
        foundPhrases.push(tactic);
      }
    }
  }
  
  // Deterministic checks
  for (const { label, regex } of PRESSURE_PATTERNS) {
    if (regex.test(text) && !foundPhrases.includes(label)) {
      foundPhrases.push(label);
    }
  }

  if (foundPhrases.length > 0) {
    return {
      claim: "pressure",
      status: "UNCLEAR",
      evidence: `Pressure or guaranteed-job tactics detected: ${foundPhrases.join(", ")}.`,
      sources: [],
      nextAction: "Evaluate cautiously. Scammers create false urgency.",
      limitations: "Legitimate recruiters sometimes use urgency, so this is a supporting signal only.",
      ruleId: "pressure.tactics_found"
    };
  }

  return {
    claim: "pressure",
    status: "VERIFIED",
    evidence: "No pressure language detected in provided text.",
    sources: [],
    nextAction: "Normal evaluation.",
    limitations: "Text analysis only.",
    ruleId: "pressure.no_tactics"
  };
}
