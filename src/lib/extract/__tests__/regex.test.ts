import { describe, it, expect } from "vitest";
import {
  extractEmails,
  extractPhones,
  extractUrls,
  extractUpi,
  extractFeeWording,
  extractRole,
} from "../regex";

describe("Regex Extraction", () => {
  describe("Phones", () => {
    const phoneCases = [
      ["+91 98765 43210", "+91 98765 43210"],
      ["9876543210", "9876543210"],
      ["098765 43210", "098765 43210"],
      ["+91-98765-43210", "+91-98765-43210"],
      ["Call 1234567890", null], // starts with 1-5 (invalid indian mobile)
      ["earn ₹35,000/month", null],
      ["5987654321", null], // starts with 5 (invalid indian mobile)
      ["12345 67890", null], // starts with 1
    ];
    it.each(phoneCases)("phone('%s') -> %s", (input, expected) => {
      const res = extractPhones(input as string);
      if (expected) {
        expect(res).toContain(expected);
      } else {
        expect(res).toHaveLength(0);
      }
    });
  });

  describe("UPI", () => {
    const upiCases = [
      ["Pay me at name@okaxis", "name@okaxis"],
      ["9876543210@paytm", "9876543210@paytm"],
      ["Contact hr@infosys.com", null],
      ["jobs@company.in", null],
    ];
    it.each(upiCases)("upi('%s') -> %s", (input, expected) => {
      const res = extractUpi(input as string);
      if (expected) {
        expect(res).toContain(expected);
      } else {
        expect(res).toHaveLength(0);
      }
    });
  });

  describe("URLs", () => {
    const urlCases = [
      ["Apply at https://bit.ly/3xyz", "https://bit.ly/3xyz"],
      ["http://rb.gy/abc", "http://rb.gy/abc"],
      ["short.link/apply", "http://short.link/apply"],
      ["Visit www.google.com", "http://www.google.com"],
    ];
    it.each(urlCases)("url('%s') -> %s", (input, expected) => {
      const res = extractUrls(input as string);
      expect(res).toContain(expected);
    });
  });

  describe("Fee Wording", () => {
    const feeCases = [
      ["pay Rs 999 registration", true],
      ["₹500 refundable security deposit", true],
      ["send 1,499 to confirm your seat", true],
      ["training fee of INR 2000", true],
      ["stipend ₹35,000/month", false],
      ["salary Rs. 4 LPA", false],
      ["no fee is ever charged", false],
      ["we never ask candidates for money", false],
      // send email/resume -> NOT a fee
      ["Send email to hr@company.com", false],
      // send money -> IS a fee
      ["Send Rs 500 to hr@ybl", true],
      ["send ₹999 registration fee", true],
      ["transfer 500 to confirm", true],
    ];
    it.each(feeCases)("fee('%s') -> %s", (input, shouldFind) => {
      const res = extractFeeWording(input as string);
      if (shouldFind) {
        expect(res.length).toBeGreaterThan(0);
      } else {
        expect(res).toHaveLength(0);
      }
    });
  });

  describe("Role Extraction", () => {
    const roleCases: [string, string | null][] = [
      ["We are hiring a Systems Engineer", "Systems Engineer"],
      ["Looking for an intern to join us", "intern"],
      ["Data Entry Clerk position available", "Data Entry"],
      // non-roles that must NOT match
      ["Please fill out the application form", null],
      ["We are a recruitment agency", null],
      ["Contact us for more information", null],
    ];
    it.each(roleCases)("extractRole('%s') -> %s", (input, expected) => {
      const res = extractRole(input as string);
      if (expected) {
        expect(res?.toLowerCase()).toBe(expected.toLowerCase());
      } else {
        expect(res).toBeUndefined();
      }
    });
  });

  describe("Emails", () => {
    const emailCases = [
      ["Contact hr@scam.com", "hr@scam.com"],
      ["john.doe@gmail.com", "john.doe@gmail.com"],
    ];
    it.each(emailCases)("email('%s') -> %s", (input, expected) => {
      const res = extractEmails(input as string);
      expect(res).toContain(expected);
    });
  });
});
