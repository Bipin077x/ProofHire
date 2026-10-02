import { describe, it, expect } from "vitest";
import { calculateRollup } from "../index";
import { VerifyResult } from "../../verify/types";

describe("calculateRollup", () => {
  it("returns HIGH if any RISK", () => {
    const results: VerifyResult[] = [
      { claim: "payment", status: "RISK", evidence: "fee requested", ruleId: "test", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.riskLevel).toBe("HIGH");
    expect(rollup.reasons[0]).toBe("fee requested");
  });

  it("returns CAUTION if company and contact are NOT_VERIFIED/UNCLEAR", () => {
    const results: VerifyResult[] = [
      { claim: "company", status: "NOT_VERIFIED", evidence: "none", ruleId: "test", sources: [] },
      { claim: "contact", status: "UNCLEAR", evidence: "none", ruleId: "test", sources: [] },
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.riskLevel).toBe("CAUTION");
    expect(rollup.reasons[0]).toContain("Core identity");
  });
  
  it("returns CAUTION if mismatch or unresolved rule hit", () => {
    const results: VerifyResult[] = [
      { claim: "link", status: "UNCLEAR", evidence: "unresolved", ruleId: "link.unresolved", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "contact", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.riskLevel).toBe("CAUTION");
    expect(rollup.reasons.some(r => r.includes("unresolved claims or mismatches"))).toBe(true);
  });
  
  it("returns UNVERIFIED if 3+ NOT_VERIFIED", () => {
    const results: VerifyResult[] = [
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "contact", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "payment", status: "NOT_VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "pressure", status: "NOT_VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "role", status: "NOT_VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
    ];
    const rollup = calculateRollup(results);
    expect(rollup.riskLevel).toBe("UNVERIFIED");
  });

  it("returns NO_FLAGS if all good", () => {
    const results: VerifyResult[] = [
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "contact", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
    ];
    const rollup = calculateRollup(results);
    expect(rollup.riskLevel).toBe("NO_FLAGS");
    // Ensure no legit/safe/genuine words
    expect(rollup.reasons[0].toLowerCase()).not.toMatch(/legit|safe|genuine|100%/);
  });
});
