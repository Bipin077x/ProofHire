import crypto from "crypto";
import { emailRegex, phoneRegex, upiRegex, urlRegex } from "./extract/regex";
import { registrableDomain } from "./verify/domain";
import type { ClaimsInput } from "./extract/claimsSchema";

export function redactText(text: string): string {
  // We apply regexes in order of specificity to avoid overlapping replaces.
  let redacted = text;
  
  // 1. Email
  redacted = redacted.replace(emailRegex, "[EMAIL]");
  
  // 2. UPI
  // The global regex from extract/regex can be used, but let's be careful about state.
  const upiRegexLocal = new RegExp(upiRegex.source, "g");
  redacted = redacted.replace(upiRegexLocal, (match) => {
    return "[UPI]";
  });
  
  // 3. Phone
  const phoneRegexLocal = new RegExp(phoneRegex.source, "g");
  redacted = redacted.replace(phoneRegexLocal, "[PHONE]");
  
  // 4. Long numbers (e.g. Aadhar, bank account). Let's define as 9+ continuous digits
  redacted = redacted.replace(/\d[ \-]?\d[ \-]?\d[ \-]?\d[ \-]?\d[ \-]?\d[ \-]?\d[ \-]?\d[ \-]?\d+/g, "[NUMBER]");
  
  return redacted;
}

export interface Indicator {
  type: "domain" | "upi" | "phone" | "email" | "shortener";
  normalizedValue: string;
}

const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly"];

export function extractIndicatorsFromText(text: string): Indicator[] {
  const indicators: Indicator[] = [];
  
  const emails = Array.from(new Set(text.match(emailRegex) || []));
  for (const e of emails) {
    indicators.push({ type: "email", normalizedValue: e.toLowerCase() });
  }
  
  const phones = Array.from(new Set(text.match(phoneRegex) || []));
  for (const p of phones) {
    // normalize: remove everything except digits
    let digits = p.replace(/\D/g, "");
    if (digits.startsWith("91") && digits.length === 12) {
      digits = digits.substring(2);
    }
    if (digits.startsWith("0") && digits.length === 11) {
      digits = digits.substring(1);
    }
    if (digits.length === 10) {
      indicators.push({ type: "phone", normalizedValue: digits });
    }
  }
  
  const upis = Array.from(new Set(text.match(upiRegex) || []));
  for (const u of upis) {
    if (!emails.some(e => e.includes(u)) && !u.includes(".com") && !u.includes(".in") && !u.includes(".org")) {
      indicators.push({ type: "upi", normalizedValue: u.toLowerCase() });
    }
  }
  
  const urls = Array.from(new Set(text.match(urlRegex) || []));
  for (const u of urls) {
    try {
      let cleanUrl = u.replace(/[.,;)]+$/, "");
      if (!/^https?:\/\//i.test(cleanUrl)) cleanUrl = "http://" + cleanUrl;
      const urlObj = new URL(cleanUrl);
      const host = urlObj.hostname;
      
      const domain = registrableDomain(host);
      if (domain) {
        if (SHORTENERS.includes(domain)) {
          indicators.push({ type: "shortener", normalizedValue: urlObj.host + urlObj.pathname });
        } else {
          indicators.push({ type: "domain", normalizedValue: domain });
        }
      }
    } catch {
      // ignore invalid URLs
    }
  }
  
  // Deduplicate
  const unique = new Map<string, Indicator>();
  for (const ind of indicators) {
    unique.set(ind.type + ":" + ind.normalizedValue, ind);
  }
  
  return Array.from(unique.values());
}

export function getSalt(): string {
  const salt = process.env.INDICATOR_SALT;
  if (!salt) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("INDICATOR_SALT is unset in production");
    }
    return "dev-salt";
  }
  return salt;
}

export function hashIndicator(ind: Indicator, salt: string = getSalt()): string {
  return crypto.createHmac("sha256", salt)
    .update(`${ind.type}:${ind.normalizedValue}`)
    .digest("hex");
}
