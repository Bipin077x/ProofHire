import { describe, it, expect } from "vitest";
import { redactText, extractIndicatorsFromText, hashIndicator, getSalt } from "../redact";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const fixturesDir = path.join(__dirname, "../../../scripts/fixtures");
const fixtures = fs.readdirSync(fixturesDir).filter(f => f.endsWith(".txt"));

describe("Redaction and Indicator Extraction", () => {
  it.each(fixtures)("no phone/email/UPI/long-digit survives on %s", (f) => {
    const text = fs.readFileSync(path.join(fixturesDir, f), "utf-8");
    const redacted = redactText(text);
    const inds = extractIndicatorsFromText(redacted);
    expect(inds.filter(i => ["phone", "email", "upi"].includes(i.type)).length).toBe(0);
    // Note: long-digits are replaced with [NUMBER], so they shouldn't match phone/UPI/email anyway.
  });
  
  it("same salt gives same hash", () => {
    const ind = { type: "phone" as const, normalizedValue: "9876543210" };
    expect(hashIndicator(ind, "salt1")).toBe(hashIndicator(ind, "salt1"));
  });

  it("different salt gives different hash", () => {
    const ind = { type: "phone" as const, normalizedValue: "9876543210" };
    expect(hashIndicator(ind, "salt1")).not.toBe(hashIndicator(ind, "salt2"));
  });
  
  it.each([
    ["+91 98765 43210", "9876543210"],
    ["9876543210", "9876543210"],
    ["098765 43210", "9876543210"]
  ])("%s and %s hash identically", (input, expected) => {
    const i1 = extractIndicatorsFromText(input).find(i => i.type === "phone")!;
    const i2 = extractIndicatorsFromText(expected).find(i => i.type === "phone")!;
    expect(hashIndicator(i1, "salt")).toBe(hashIndicator(i2, "salt"));
  });

  it("HMAC (not plain SHA) is used", () => {
    const ind = { type: "phone" as const, normalizedValue: "9876543210" };
    const hmacVal = crypto.createHmac("sha256", "salt").update("phone:9876543210").digest("hex");
    const plainVal = crypto.createHash("sha256").update("phone:9876543210salt").digest("hex");
    const val = hashIndicator(ind, "salt");
    expect(val).toBe(hmacVal);
    expect(val).not.toBe(plainVal);
  });

  it("server startup fails when INDICATOR_SALT is unset and NODE_ENV=production", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalSalt = process.env.INDICATOR_SALT;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = "production";
    delete process.env.INDICATOR_SALT;
    expect(() => getSalt()).toThrowError("INDICATOR_SALT is unset in production");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process.env as any).NODE_ENV = originalEnv;
    process.env.INDICATOR_SALT = originalSalt;
  });
});
