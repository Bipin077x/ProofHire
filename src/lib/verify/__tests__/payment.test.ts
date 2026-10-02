import { describe, it, expect } from "vitest";
import { verifyPayment } from "../payment";

describe("Payment Verifier", () => {
  describe("Scam cases", () => {
    it("flags UPI requests", () => {
      const result = verifyPayment({ transcript: "Send to name@okaxis", payment: { method: "name@okaxis" } });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("payment.upi_request");
    });
    
    it("flags fee wording", () => {
      const result = verifyPayment({ transcript: "pay Rs 999 registration", payment: { requested: true, wording: "pay Rs 999 registration" } });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("payment.fee_wording");
    });
    
    it("flags deposit requests", () => {
      const result = verifyPayment({ transcript: "refundable security deposit", payment: { requested: true, wording: "refundable security deposit" } });
      expect(result.status).toBe("RISK");
    });
    
    it("flags training fees", () => {
      const result = verifyPayment({ transcript: "training fee of INR 2000", payment: { requested: true, wording: "training fee of INR 2000" } });
      expect(result.status).toBe("RISK");
    });
    
    it("flags fee request in different sentence than negation", () => {
      // "No fee is charged for the course. Pay ₹500 registration to confirm your seat."
      // The extracted wording will reflect the fee request
      const result = verifyPayment({ transcript: "No fee is charged for the course. Pay ₹500 registration to confirm your seat.", payment: { requested: true, wording: "Pay ₹500 registration to confirm your seat." } });
      expect(result.status).toBe("RISK");
    });
  });

  describe("Legitimate cases", () => {
    it("does not flag if LLM extracted false", () => {
      const result = verifyPayment({ transcript: "no fee is ever charged", payment: { requested: false } });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("does not flag missing payment object entirely", () => {
      const result = verifyPayment({ transcript: "Normal job description" });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("handles stipends safely", () => {
      const result = verifyPayment({ transcript: "Stipend ₹35,000/month", payment: { requested: false } });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("handles salaries safely", () => {
      const result = verifyPayment({ transcript: "Salary Rs. 4 LPA", payment: { requested: false } });
      expect(result.status).toBe("VERIFIED");
    });
    
    it("handles explicit negative fee statement safely", () => {
      const result = verifyPayment({ transcript: "We never ask candidates for money.", payment: { requested: false } });
      expect(result.status).toBe("VERIFIED");
    });
  });
  
  describe("Edge cases", () => {
    it("handles empty transcript", () => {
      const result = verifyPayment({ transcript: "" });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("payment.missing_text");
    });
  });
});
