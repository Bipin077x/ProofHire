import { describe, it, expect } from "vitest";
import { verifyPayment } from "../payment";

describe("Payment Verifier", () => {
  describe("Prompt Table Tests", () => {
    const cases = [
      { transcript: "No fee for the course, pay ₹500 registration to confirm your seat.", expected: "RISK" },
      { transcript: "This is not a scam, pay Rs 999 to book your slot.", expected: "RISK" },
      { transcript: "No registration fee is charged.", expected: "VERIFIED" },
      { transcript: "We never ask candidates for money.", expected: "VERIFIED" },
      { transcript: "Training is free. Send ₹1,499 as refundable deposit.", expected: "RISK" },
      { transcript: "No interview needed, only a ₹300 kit charge.", expected: "RISK" },
      { transcript: "There is no fee to apply, and stipend is ₹35,000/month.", expected: "VERIFIED" }
    ];
    
    it("matches all table cases", () => {
      for (const c of cases) {
        const result = verifyPayment({ transcript: c.transcript });
        expect(result.status, `Failed on "${c.transcript}"`).toBe(c.expected);
      }
    });
  });

  describe("Other cases", () => {
    it("flags UPI requests extracted by regex", () => {
      const result = verifyPayment({ transcript: "Send to name@okaxis", payment: { method: "name@okaxis" } });
      expect(result.status).toBe("RISK");
      expect(result.ruleId).toBe("payment.upi_request");
    });
    
    it("handles empty transcript", () => {
      const result = verifyPayment({ transcript: "" });
      expect(result.status).toBe("UNCLEAR");
      expect(result.ruleId).toBe("payment.missing_text");
    });
  });
});
