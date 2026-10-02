import { describe, it, expect } from "vitest";
import { verifyPressure } from "../pressure";

describe("Pressure Verifier", () => {
  describe("Table tests", () => {
    it.each([
      ["Urgent hiring! We need 50 candidates today.", "UNCLEAR"],
      ["walk-in interview for developers", "UNCLEAR"],
      ["we need immediate joining for this role", "UNCLEAR"],
      ["apply today or miss out", "UNCLEAR"],
      ["limited seats available, hurry up", "UNCLEAR"],
      ["last date today to register", "UNCLEAR"],
      ["pay now to confirm your slot", "UNCLEAR"],
      ["we offer 100% placement guarantee", "UNCLEAR"],
      ["We are looking for a software engineer to join our team.", "VERIFIED"],
      ["Valid job description without any tactics.", "VERIFIED"],
      ["Please submit your resume by Friday.", "VERIFIED"]
    ])("given %s, returns %s", (transcript, expectedStatus) => {
      const result = verifyPressure({ transcript });
      expect(result.status).toBe(expectedStatus);
      if (expectedStatus === "UNCLEAR") {
        expect(result.ruleId).toBe("pressure.tactics_found");
      } else {
        expect(result.ruleId).toBe("pressure.no_tactics");
      }
    });
  });

  describe("Edge cases", () => {
    it("handles missing transcript", () => {
      const result = verifyPressure({});
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("pressure.missing_text");
    });
    
    it("deduplicates found tactics", () => {
      const result = verifyPressure({ transcript: "limited seats! limited seats!", pressureTactics: ["limited seats"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.evidence.match(/limited seats/g)?.length).toBe(1);
    });
    
    it("flags tactics passed from LLM extraction", () => {
      const result = verifyPressure({ transcript: "Normal text", pressureTactics: ["buy now"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.evidence).toContain("buy now");
    });
  });
});
