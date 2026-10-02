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
    const text1 = "Call me at +91 98765 43210 or 9876543210";
    const result1 = extractPhones(text1);
    expect(result1).toContain("+91 98765 43210");
    expect(result1).toContain("9876543210");
  });

  it("extracts upi IDs", () => {
    const text = "Pay me at name@okaxis or some123@ybl";
    const result = extractUpi(text);
    expect(result).toContain("name@okaxis");
    expect(result).toContain("some123@ybl");
  });

  it("extracts URLs and shorteners", () => {
    const text = "Apply at https://bit.ly/3xyz or http://rb.gy/abc";
    const result = extractUrls(text);
    expect(result).toContain("https://bit.ly/3xyz");
    expect(result).toContain("http://rb.gy/abc");
  });

  it("extracts fee wording but ignores stipends", () => {
    const text = "pay Rs 999 registration fee for kit";
    const result = extractFeeWording(text);
    expect(result.some((r) => r.toLowerCase().includes("pay rs 999 registration"))).toBe(true);
    
    const text2 = "Earn a ₹35,000/month stipend";
    const result2 = extractFeeWording(text2);
    // Should not flag as fee wording
    expect(result2).toEqual([]);
  });

  it("extracts emails", () => {
    const text = "Contact hr@scam.com or john.doe@gmail.com";
    const result = extractEmails(text);
    expect(result).toContain("hr@scam.com");
    expect(result).toContain("john.doe@gmail.com");
  });
});
