import { describe, it, expect } from "vitest";
import { redactText, extractIndicatorsFromText, hashIndicator } from "../redact";
import fs from "fs";
import path from "path";

describe("Redaction and Indicator Extraction", () => {
  it("redacts phone, email, upi, and numbers", () => {
    const text = "Call +91 98765 43210 or email test@gmail.com. Pay via test@okaxis. My Aadhar is 1234 5678 9012.";
    const redacted = redactText(text);
    
    expect(redacted).not.toContain("98765");
    expect(redacted).not.toContain("test@gmail.com");
    expect(redacted).not.toContain("test@okaxis");
    expect(redacted).not.toContain("1234 5678 9012");
    
    expect(redacted).toContain("[PHONE]");
    expect(redacted).toContain("[EMAIL]");
    expect(redacted).toContain("[UPI]");
    expect(redacted).toContain("[NUMBER]");
  });
  
  it("same salt gives same hash, different salt gives different hash", () => {
    const ind = { type: "phone" as const, normalizedValue: "9876543210" };
    const h1 = hashIndicator(ind, "salt1");
    const h2 = hashIndicator(ind, "salt1");
    const h3 = hashIndicator(ind, "salt2");
    
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
  
  it("normalization makes +91 and 10-digit hash identically", () => {
    const i1 = extractIndicatorsFromText("+91 98765 43210").find(i => i.type === "phone")!;
    const i2 = extractIndicatorsFromText("9876543210").find(i => i.type === "phone")!;
    
    expect(i1.normalizedValue).toBe("9876543210");
    expect(i2.normalizedValue).toBe("9876543210");
    expect(hashIndicator(i1, "salt")).toBe(hashIndicator(i2, "salt"));
  });

  it("no phone/email/upi survives redaction on fixtures", () => {
    const fixturesDir = path.join(__dirname, "../../../scripts/fixtures");
    const files = fs.readdirSync(fixturesDir);
    for (const f of files) {
      if (!f.endsWith(".txt")) continue;
      const text = fs.readFileSync(path.join(fixturesDir, f), "utf-8");
      const redacted = redactText(text);
      
      const inds = extractIndicatorsFromText(redacted);
      expect(inds.filter(i => ["phone", "email", "upi"].includes(i.type)).length).toBe(0);
    }
  });
});
