import { VerifyResult } from "./types";

const PRESSURE_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "urgent", regex: /\burgent(?:ly)?\b/i },
  { label: "need N candidates today", regex: /need \d+ candidates today/i },
  { label: "walk-in", regex: /\bwalk-in\b/i },
  { label: "immediate joining", regex: /\bimmediate joining\b/i },
  { label: "apply today", regex: /\bapply today\b/i },
  { label: "limited seats", regex: /\blimited seats\b/i },
  { label: "last date today", regex: /\blast date today\b/i },
  { label: "confirm your slot", regex: /\bconfirm your slot\b/i },
  // Old ones for backward compatibility
  { label: "confirm seat", regex: /\bconfirm seat\b/i },
  { label: "guaranteed job", regex: /\bguaranteed job\b/i },
  { label: "no interview", regex: /\bno interview\b/i },
  { label: "earn per day", regex: /\bearn per day\b/i },
  { label: "earn daily", regex: /\bearn daily\b/i },
  { label: "before it's too late", regex: /before it's too late/i },
  { label: "hurry", regex: /\bhurry\b/i },
  { label: "immediate hiring", regex: /\bimmediate hiring\b/i },
  { label: "100% placement", regex: /100% placement/i }
];

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
