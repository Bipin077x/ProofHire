import { describe, it, expect } from "vitest";
import { calculateRollup } from "../index";
import { VerifyResult, ClaimKey, Status } from "../../verify/types";

function createRes(claim: ClaimKey, status: Status, ruleId = "test.rule", evidence = "Test"): VerifyResult {
  return { claim, status, ruleId, evidence, sources: [] };
}

describe("calculateRollup", () => {
  it("Rule 1: returns UNVERIFIED if transcript empty", () => {
    const results: VerifyResult[] = [
      { claim: "payment", status: "UNCLEAR", evidence: "", ruleId: "payment.missing_text", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("UNVERIFIED");
  });

  it("Rule 2: returns HIGH_RISK if payment RISK", () => {
    const results: VerifyResult[] = [
      { claim: "payment", status: "RISK", evidence: "fee requested", ruleId: "payment.fee_found", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("HIGH_RISK");
    expect(rollup.reasons[0]).toBe("fee requested");
  });

  it("Rule 3: returns HIGH_RISK if >=2 RISK", () => {
    const results: VerifyResult[] = [
      { claim: "contact", status: "RISK", evidence: "bad contact", ruleId: "test", sources: [] },
      { claim: "company", status: "RISK", evidence: "bad company", ruleId: "test", sources: [] },
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("HIGH_RISK");
    expect(rollup.reasons.length).toBe(2);
  });

  it("Rule 3 constraint: pressure RISK does not count", () => {
    const results: VerifyResult[] = [
      { claim: "contact", status: "RISK", evidence: "bad contact", ruleId: "test", sources: [] },
      { claim: "pressure", status: "RISK", evidence: "high pressure", ruleId: "test", sources: [] },
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("CAUTION"); // Only 1 core RISK
  });
  
  it("Rule 4: returns CAUTION if exactly 1 core RISK", () => {
    const results: VerifyResult[] = [
      { claim: "link", status: "RISK", evidence: "bad link", ruleId: "link.suspicious", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "contact", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("CAUTION");
  });
  
  it("Rule 5: returns UNVERIFIED if system.check_failed", () => {
    const results: VerifyResult[] = [
      { claim: "link", status: "UNCLEAR", evidence: "timeout", ruleId: "system.check_failed", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("UNVERIFIED");
  });

  it("Rule 6: returns NO_RED_FLAGS_FOUND if payment, company, contact, link are all VERIFIED", () => {
    const results: VerifyResult[] = [
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "contact", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "link", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "role", status: "UNCLEAR", evidence: "not found", ruleId: "test", sources: [] },
      { claim: "pressure", status: "UNCLEAR", evidence: "none", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("NO_RED_FLAGS_FOUND");
    // Ensure no legit/safe/genuine words
    expect(rollup.reasons[0].toLowerCase()).not.toMatch(/legit|safe|genuine|100%/);
  });
  
  it("Rule 6 constraint: returns UNVERIFIED if missing one required VERIFIED", () => {
    const results: VerifyResult[] = [
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "contact", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "link", status: "NOT_VERIFIED", evidence: "missing", ruleId: "test", sources: [] },
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("UNVERIFIED");
  });

  it("returns CAUTION if only company is RISK", () => {
    const results: VerifyResult[] = [
      { claim: "company", status: "RISK", evidence: "fake", ruleId: "test", sources: [] },
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("CAUTION");
  });

  it("returns UNVERIFIED if only 2 claims are VERIFIED and no RISK", () => {
    const results: VerifyResult[] = [
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("UNVERIFIED");
  });

  it("returns HIGH_RISK if company and link are RISK", () => {
    const results: VerifyResult[] = [
      { claim: "company", status: "RISK", evidence: "fake", ruleId: "test", sources: [] },
      { claim: "link", status: "RISK", evidence: "fake", ruleId: "test", sources: [] },
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] }
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("HIGH_RISK");
  });

  it("returns UNVERIFIED if contact is UNCLEAR and others VERIFIED", () => {
    const results: VerifyResult[] = [
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "contact", status: "UNCLEAR", evidence: "no contact", ruleId: "test", sources: [] },
      { claim: "link", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("UNVERIFIED");
  });

  it("returns UNVERIFIED if link is UNCLEAR and others VERIFIED", () => {
    const results: VerifyResult[] = [
      { claim: "payment", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "company", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "contact", status: "VERIFIED", evidence: "ok", ruleId: "test", sources: [] },
      { claim: "link", status: "UNCLEAR", evidence: "no link", ruleId: "test", sources: [] },
    ];
    const rollup = calculateRollup(results);
    expect(rollup.verdict).toBe("UNVERIFIED");
  });

  it("evaluates reports RISK correctly", () => {
    // 1 report RISK alone = CAUTION
    const resCaution = calculateRollup([
      createRes("reports", "RISK", "reports.known_indicator"),
      createRes("company", "VERIFIED"),
    ]);
    expect(resCaution.verdict).toBe("CAUTION");

    // 1 report RISK + 1 other RISK (e.g. contact) = HIGH_RISK
    const resHigh = calculateRollup([
      createRes("reports", "RISK", "reports.known_indicator"),
      createRes("contact", "RISK"),
    ]);
    expect(resHigh.verdict).toBe("HIGH_RISK");
  });
});
