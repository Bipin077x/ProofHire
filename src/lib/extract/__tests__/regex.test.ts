import { describe, it, expect } from "vitest";
import {
  extractEmails,
  extractPhones,
  extractUrls,
  extractUpi,
  extractFeeWording,
} from "../regex";

describe("Regex Extraction", () => {
  it("extracts indian phone formats", () => {
    const text1 = "Call me at +91 98765 43210 or 9876543210 or 098765 43210 or +91-98765-43210";
    const result1 = extractPhones(text1);
    expect(result1).toContain("+91 98765 43210");
    expect(result1).toContain("9876543210");
    expect(result1).toContain("098765 43210");
    expect(result1).toContain("+91-98765-43210");
  });

  it("does not extract negative phone formats", () => {
    const text = "Call 1234567890 or earn ₹35,000/month or 5987654321";
    const result = extractPhones(text);
    expect(result).toHaveLength(0);
  });

  it("extracts upi IDs", () => {
    const text = "Pay me at name@okaxis or 9876543210@paytm";
    const result = extractUpi(text);
    expect(result).toContain("name@okaxis");
    expect(result).toContain("9876543210@paytm");
  });

  it("does not extract emails as upi IDs", () => {
    const text = "Contact hr@infosys.com or jobs@company.in";
    const result = extractUpi(text);
    expect(result).toHaveLength(0);
  });

  it("extracts URLs and shorteners", () => {
    const text = "Apply at https://bit.ly/3xyz or http://rb.gy/abc or short.link/apply. Visit www.google.com.";
    const result = extractUrls(text);
    expect(result).toContain("https://bit.ly/3xyz");
    expect(result).toContain("http://rb.gy/abc");
    expect(result).toContain("http://short.link/apply");
    expect(result).toContain("http://www.google.com");
  });

  it("extracts fee wording", () => {
    const phrases = [
      "pay Rs 999 registration",
      "₹500 refundable security deposit",
      "send 1,499 to confirm your seat",
      "training fee of INR 2000"
    ];
    for (const phrase of phrases) {
      const result = extractFeeWording(phrase);
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it("does not extract fee wording for false positives", () => {
    const phrases = [
      "stipend ₹35,000/month",
      "salary Rs. 4 LPA",
      "no fee is ever charged",
      "we never ask candidates for money"
    ];
    for (const phrase of phrases) {
      const result = extractFeeWording(phrase);
      expect(result).toHaveLength(0);
    }
  });

  it("extracts emails", () => {
    const text = "Contact hr@scam.com or john.doe@gmail.com";
    const result = extractEmails(text);
    expect(result).toContain("hr@scam.com");
    expect(result).toContain("john.doe@gmail.com");
  });
});
