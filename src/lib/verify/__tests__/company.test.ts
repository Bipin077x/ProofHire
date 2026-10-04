import { describe, it, expect } from "vitest";
import { verifyCompany } from "../company";

describe("Company Verifier", () => {
  describe("Scam / Risk cases", () => {
    // Actually company.ts never returns RISK. It returns UNCLEAR at worst.
    it("returns UNCLEAR for known brand without proof (email)", () => {
      const result = verifyCompany({ company: "Microsoft", emails: ["hr@gmail.com"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("company.known_without_proof");
    });
    
    it("returns UNCLEAR for known brand without proof (url)", () => {
      const result = verifyCompany({ company: "Microsoft", urls: ["https://forms.gle/xyz"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("company.known_without_proof");
    });
    
    it("returns UNCLEAR for known brand without any contact", () => {
      const result = verifyCompany({ company: "Microsoft" });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("company.known_without_proof");
    });
    
    it("returns UNCLEAR for known brand with lookalike domain", () => {
      const result = verifyCompany({ company: "Microsoft", urls: ["https://microsooft.com"] });
      expect(result.status).toBe("UNCLEAR");
    });
    
    it("returns UNCLEAR for unknown company", () => {
      const result = verifyCompany({ company: "Random LLC" });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("company.unknown");
    });
  });

  describe("Legitimate cases", () => {
    it("returns VERIFIED for known brand with email proof", () => {
      const result = verifyCompany({ company: "Microsoft", emails: ["hr@microsoft.com"] });
      expect(result.status).toBe("VERIFIED");
      expect(result.ruleId).toBe("company.known_with_proof");
      expect(result.evidence).toBe("Named in the post.");
    });

    it("returns VERIFIED for known brand with link proof", () => {
      const result = verifyCompany({ company: "Microsoft", urls: ["https://careers.microsoft.com/jobs"] });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("returns VERIFIED for known brand with alternative official link", () => {
      const result = verifyCompany({ company: "Amazon", urls: ["https://amazon.jobs"] });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("returns VERIFIED for known brand with case insensitive official link", () => {
      const result = verifyCompany({ company: "Microsoft", urls: ["https://MICROSOFT.com"] });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("returns VERIFIED for alias resolution with official link", () => {
      const result = verifyCompany({ company: "Alphabet", urls: ["https://google.com"] });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("returns VERIFIED and proper evidence for inferred company", () => {
      // @ts-ignore
      const result = verifyCompany({ company: "Google", companySource: "inferred_from_domain", emails: ["hr@google.com"] });
      expect(result.status).toBe("VERIFIED");
      expect(result.ruleId).toBe("company.inferred");
      expect(result.evidence).toBe("Inferred from the official domain in the link; the post does not name the company.");
    });
  });
  
  describe("Edge cases", () => {
    it("handles missing company", () => {
      const result = verifyCompany({});
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("company.missing");
    });

    it("Tech Mahindra named_in_post -> VERIFIED when official domain present", () => {
      // companySource: "named_in_post" means the LLM extracted the company name from the post text
      const result = verifyCompany({
        company: "Tech Mahindra",
        companySource: "named_in_post" as const,
        urls: ["https://careers.techmahindra.com"]
      });
      expect(result.status).toBe("VERIFIED");
      expect(result.ruleId).toBe("company.known_with_proof");
    });

    it("Tech Mahindra without proof -> UNCLEAR", () => {
      const result = verifyCompany({ company: "Tech Mahindra" });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("company.known_without_proof");
    });
  });
});
