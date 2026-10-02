import { VerifyResult } from "./types";

const PRESSURE_PHRASES = [
  "urgency",
  "limited seats",
  "confirm seat",
  "guaranteed job",
  "no interview",
  "earn per day",
  "earn daily",
  "before it's too late",
  "hurry",
  "immediate hiring",
  "100% placement"
];

interface PressureClaims { transcript?: string; pressureTactics?: string[]; }

export function verifyPressure(claims: PressureClaims): VerifyResult {
  const foundPhrases: string[] = [];
  
  const text = claims.transcript ? claims.transcript.toLowerCase() : "";
  
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
    foundPhrases.push(...claims.pressureTactics);
  }
  
  // Deterministic checks
  for (const phrase of PRESSURE_PHRASES) {
    if (text.includes(phrase) && !foundPhrases.includes(phrase)) {
      foundPhrases.push(phrase);
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
