import { describe, it, expect } from "vitest";
import { verifyPayment } from "../payment";

describe("Payment Verifier", () => {
  describe("Table-driven cases", () => {
    const cases: [string, string][] = [
      ["No fee for the course, pay ₹500 registration to confirm your seat.", "RISK"],
      ["This is not a scam, pay Rs 999 to book your slot.", "RISK"],
      ["No registration fee is charged.", "VERIFIED"],
      ["We never ask candidates for money.", "VERIFIED"],
      ["Training is free. Send ₹1,499 as refundable deposit.", "RISK"],
      ["No interview needed, only a ₹300 kit charge.", "RISK"],
      ["There is no fee to apply, and stipend is ₹35,000/month.", "VERIFIED"],
      ["pay to confirm seat", "RISK"],
      ["no fee is ever charged", "VERIFIED"],
      ["Normal job description with no payment request.", "VERIFIED"],
      ["Stipend ₹35,000/month", "VERIFIED"],
      ["Salary Rs. 4 LPA", "VERIFIED"],
      ["refundable security deposit of ₹500", "RISK"],
      ["training fee of INR 2000", "RISK"],
      ["pay Rs 999 registration fee", "RISK"]
    ];

    it.each(cases)("payment('%s') => %s", (transcript, expected) => {
      const result = verifyPayment({ transcript });
      expect(result.status).toBe(expected);
    });
  });

  describe("Sentence Splitting Regressions", () => {
    it("does not break on UPI ids (hr.google@ybl)", () => {
      const result = verifyPayment({ transcript: "Please pay a refundable registration fee of ₹500 via UPI to hr.google@ybl to confirm your slot." });
      expect(result.status).toBe("RISK");
      expect(result.evidence).toContain("hr.google@ybl");
    });
    
    it("does not break on abbreviations like Rs.", () => {
      const result = verifyPayment({ transcript: "Pay Rs. 999 to confirm." });
      expect(result.status).toBe("RISK");
      expect(result.evidence).toContain("Pay Rs. 999 to confirm");
    });
  });

  describe("UPI and edge cases", () => {
    it("flags UPI requests extracted by regex", () => {
      const result = verifyPayment({ transcript: "Send to name@okaxis", payment: { method: "name@okaxis" } });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("payment.upi_request");
    });
    
    it("handles empty transcript -> UNCLEAR", () => {
      const result = verifyPayment({ transcript: "" });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("payment.missing_text");
    });
  });
});
