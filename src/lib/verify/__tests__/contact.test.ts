import { describe, it, expect } from "vitest";
import { verifyContact } from "../contact";

describe("Contact Verifier", () => {
  describe("Scam / Risk cases", () => {
    it("flags free-mail with known company", () => {
      const result = verifyContact({ company: "Google", emails: ["hr.google@gmail.com"] });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("contact.freemail_known_brand");
    });
    
    it("flags free-mail proton with known company", () => {
      const result = verifyContact({ company: "Microsoft", emails: ["ms.recruiting@proton.me"] });
      expect(result.status).toBe("RISK");
    });
    
    it("flags lookalike domains", () => {
      const result = verifyContact({ company: "Google", emails: ["hr@g00gle.com"] });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("contact.email_lookalike");
    });
    
    it("flags hyphenated lookalike domains", () => {
      const result = verifyContact({ company: "Microsoft", emails: ["hr@microsoft-hiring.co"] });
      expect(result.status).toBe("RISK");
    });
    
    it("flags punycode lookalike domains", () => {
      const result = verifyContact({ company: "Google", emails: ["hr@xn--ggle-0nda.com"] });
      expect(result.status).toBe("RISK");
    });
  });

  describe("Legitimate cases", () => {
    it("verifies official email domain", () => {
      const result = verifyContact({ company: "Google", emails: ["recruiter@google.com"] });
      expect(result.status).toBe("VERIFIED");
      expect(result.ruleId).toBe("contact.email_official");
    });
    
    it("verifies official secondary email domain", () => {
      const result = verifyContact({ company: "Amazon", emails: ["hr@amazon.jobs"] });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("verifies official subdomain", () => {
      const result = verifyContact({ company: "Google", emails: ["hr@careers.google.com"] });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("verifies official domain with casing differences", () => {
      const result = verifyContact({ company: "Microsoft", emails: ["hr@MICROSOFT.COM"] });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("verifies official domain when company alias is provided", () => {
      const result = verifyContact({ company: "Alphabet", emails: ["hr@google.com"] });
      expect(result.status).toBe("VERIFIED");
    });
  });
  
  describe("Edge cases", () => {
    it("returns UNCLEAR for unknown company with email", () => {
      const result = verifyContact({ company: "Some Startup", emails: ["hr@somestartup.com"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("contact.unknown_company");
    });

    it("returns UNCLEAR for phone only", () => {
      const result = verifyContact({ company: "Google", phones: ["+91 9876543210"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("contact.phone_only");
    });
    
    it("handles missing contact", () => {
      const result = verifyContact({ company: "Google" });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("contact.missing");
    });
    
    it("flags reserved/example domains as placeholder (UNCLEAR)", () => {
      const result = verifyContact({ company: "Google", emails: ["hr@example.com"] });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("contact.placeholder");
      
      const result2 = verifyContact({ company: "Google", emails: ["hr@test.com"] });
      expect(result2.status).toBe("UNCLEAR");
      
      const result3 = verifyContact({ company: "Google", emails: ["hr@my-site.invalid"] });
      expect(result3.status).toBe("UNCLEAR");
    });
  });
});
