import { describe, it, expect } from "vitest";
import { verifyPressure } from "../pressure";

describe("Pressure Verifier", () => {
  describe("Scam / Risk cases", () => {
    // Pressure only returns UNCLEAR at worst
    it("flags 'urgency' tactics in transcript", () => {
      const result = verifyPressure({ transcript: "Please apply with urgency!" });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("pressure.tactics_found");
    });
    
    it("flags 'limited seats' tactics in transcript", () => {
      const result = verifyPressure({ transcript: "Hurry up! limited seats available." });
      expect(result.status).toBe("UNCLEAR");
    });
    
    it("flags 'guaranteed job' tactics in transcript", () => {
      const result = verifyPressure({ transcript: "Join our course for a guaranteed job." });
      expect(result.status).toBe("UNCLEAR");
    });
    
    it("flags 'earn per day' tactics in transcript", () => {
      const result = verifyPressure({ transcript: "earn per day Rs 5000" });
      expect(result.status).toBe("UNCLEAR");
    });
    
    it("flags tactics passed from LLM extraction", () => {
      const result = verifyPressure({ transcript: "Normal text", pressureTactics: ["buy now"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.evidence).toContain("buy now");
    });
  });

  describe("Legitimate cases", () => {
    it("verifies when no pressure in normal transcript", () => {
      const result = verifyPressure({ transcript: "We are looking for a software engineer to join our team." });
      expect(result.status).toBe("VERIFIED");
      expect(result.ruleId).toBe("pressure.no_tactics");
    });
    
    it("verifies when no pressure and empty array", () => {
      const result = verifyPressure({ transcript: "Valid job description.", pressureTactics: [] });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("verifies uppercase normal text", () => {
      const result = verifyPressure({ transcript: "APPLY NOW FOR SOFTWARE ENGINEER" });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("verifies simple instructions", () => {
      const result = verifyPressure({ transcript: "Please submit your resume by Friday." });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("verifies when LLM did not extract anything", () => {
      const result = verifyPressure({ transcript: "Standard text without tactics.", pressureTactics: undefined });
      expect(result.status).toBe("VERIFIED");
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
  });
});
