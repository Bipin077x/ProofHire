import { describe, it, expect } from "vitest";
import { verifyPayment } from "../payment";
import { verifyContact } from "../contact";
import { verifyCompany } from "../company";
import { verifyPressure } from "../pressure";
import { isLookalike, registrableDomain } from "../domain";
import { resolveCompany } from "../data/companies";

describe("Domain Helpers", () => {
  it("extracts registrable domains correctly", () => {
    expect(registrableDomain("google.com")).toBe("google.com");
    expect(registrableDomain("careers.google.com")).toBe("google.com");
    expect(registrableDomain("amazon.co.in")).toBe("amazon.co.in");
    expect(registrableDomain("my.amazon.co.in")).toBe("amazon.co.in");
  });

  it("identifies lookalikes and homographs", () => {
    const domains = ["google.com"];
    expect(isLookalike("g00gle.com", domains)).toBe(true);
    expect(isLookalike("google-careers.com", domains)).toBe(true);
    expect(isLookalike("google.com.evil.in", domains)).toBe(true);
    expect(isLookalike("xn--googl-0q1b.com", domains)).toBe(true); // punycode
    expect(isLookalike("careers.google.com", domains)).toBe(false); // official subdomain
    expect(isLookalike("google.com", domains)).toBe(false); // official
  });
});

describe("Payment Verifier", () => {
  it("flags UPI request", () => {
    const result = verifyPayment({ transcript: "Send to name@okaxis", payment: { method: "name@okaxis" } });
    expect(result.status).toBe("RISK");
    expect(result.ruleId).toBe("payment.upi_request");
  });

  it("flags fee wording", () => {
    const result = verifyPayment({ transcript: "pay Rs 999 registration", payment: { requested: true, wording: "pay Rs 999 registration" } });
    expect(result.status).toBe("RISK");
    expect(result.ruleId).toBe("payment.fee_wording");
  });

  it("does not flag 'no fee is ever charged'", () => {
    // If our regex didn't extract any payment info, the LLM shouldn't have either (regex overrides if implemented, but here we just pass the mock).
    // The verifier just checks claims.payment
    const result = verifyPayment({ transcript: "no fee is ever charged", payment: { requested: false } });
    expect(result.status).toBe("VERIFIED");
  });

  it("handles empty transcript", () => {
    const result = verifyPayment({ transcript: "" });
    expect(result.status).toBe("UNCLEAR");
  });
});

describe("Contact Verifier", () => {
  it("flags free-mail with known company", () => {
    const result = verifyContact({ company: "Google", emails: ["hr.google@gmail.com"] });
    expect(result.status).toBe("RISK");
    expect(result.ruleId).toBe("contact.freemail_known_brand");
  });

  it("verifies official email domain", () => {
    const result = verifyContact({ company: "Google", emails: ["recruiter@google.com"] });
    expect(result.status).toBe("VERIFIED");
    expect(result.ruleId).toBe("contact.email_official");
  });

  it("flags lookalike domains", () => {
    const result = verifyContact({ company: "Google", emails: ["hr@g00gle.com"] });
    expect(result.status).toBe("RISK");
    expect(result.ruleId).toBe("contact.email_lookalike");
  });

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
});

describe("Company Verifier", () => {
  it("returns VERIFIED for known brand with email proof", () => {
    const result = verifyCompany({ company: "Microsoft", emails: ["hr@microsoft.com"] });
    expect(result.status).toBe("VERIFIED");
  });

  it("returns VERIFIED for known brand with link proof", () => {
    const result = verifyCompany({ company: "Microsoft", urls: ["https://careers.microsoft.com/jobs"] });
    expect(result.status).toBe("VERIFIED");
  });

  it("returns UNCLEAR for known brand without proof", () => {
    const result = verifyCompany({ company: "Microsoft", emails: ["hr@gmail.com"] });
    expect(result.status).toBe("UNCLEAR");
    expect(result.ruleId).toBe("company.known_without_proof");
  });

  it("returns UNCLEAR for unknown company", () => {
    const result = verifyCompany({ company: "Random LLC" });
    expect(result.status).toBe("UNCLEAR");
    expect(result.ruleId).toBe("company.unknown");
  });

  it("handles null company", () => {
    const result = verifyCompany({});
    expect(result.status).toBe("UNCLEAR");
  });
});

describe("Pressure Verifier", () => {
  it("flags pressure tactics", () => {
    const result = verifyPressure({ transcript: "Confirm seat quickly! Limited seats." });
    expect(result.status).toBe("UNCLEAR");
  });

  it("verifies when no pressure", () => {
    const result = verifyPressure({ transcript: "We are looking for a software engineer." });
    expect(result.status).toBe("VERIFIED");
  });
});
