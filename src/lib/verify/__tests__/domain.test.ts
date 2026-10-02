import { describe, it, expect } from "vitest";
import { isOfficial, isLookalike, registrableDomain } from "../domain";

describe("Domain Verifier", () => {
  it("extracts registrable domain", () => {
    expect(registrableDomain("careers.google.com")).toBe("google.com");
    expect(registrableDomain("infosys.co.in")).toBe("infosys.co.in");
  });
  
  const official = [
    ["careers.google.com", "google", true],
    ["Careers.GOOGLE.com", "google", true],
    ["google.com.evil.in", "google", false],
    ["mygoogle.com", "google", false],
  ];
  it.each(official)("isOfficial %s %s -> %s", (domain, _comp, exp) => {
    expect(isOfficial(domain as string, ["google.com"])).toBe(exp);
  });
  
  const lookalike = [
    ["g00gle-careers.in", "google", true],
    ["microsoft-hiring.co", "microsoft", true],
    ["xn--ggle-0nda.com", "google", true],
    ["g0ogle.com", "google", true],
    ["google-support.in", "google", true],
    ["apple.com.evil.in", "apple", true], // subdomain spoofing
    ["amazon-jobs.org", "amazon", true] // hyphen separation
  ];
  it.each(lookalike)("isLookalike %s %s -> %s", (domain, comp, exp) => {
    expect(isLookalike(domain as string, [comp + ".com"])).toBe(exp);
  });
});
