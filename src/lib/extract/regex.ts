export const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
export const phoneRegex = /(?:\+91[\s-]?)?(?:\d{5}[\s-]?\d{5}|\d{4}[\s-]?\d{3}[\s-]?\d{3})/g;
export const urlRegex = /(https?:\/\/[^\s]+)/g;
export const upiRegex = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g;
export const feeWordingRegex = /(?:pay|payment|fee|charge|registration)[^.,]*(?:\b(?:₹|Rs\.?|INR)\s?\d+[\d,]*(?!\s*(?:\/|\sper\s)\s*(?:month|yr|year|week|day|hr|hour)))?/gi;

export function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(emailRegex) || []));
}
export function extractPhones(text: string): string[] {
  return Array.from(new Set(text.match(phoneRegex) || []));
}
export function extractUrls(text: string): string[] {
  return Array.from(new Set(text.match(urlRegex) || []));
}
export function extractUpi(text: string): string[] {
  return Array.from(new Set(text.match(upiRegex) || []));
}
export function extractFeeWording(text: string): string[] {
  // Negative lookahead applied in the regex to skip stipends like "₹35,000/month"
  // Let's refine fee wording detection to not blindly match "payment" without amounts, but the regex already handles this.
  const matches = text.match(feeWordingRegex) || [];
  // Filter out some false positives if necessary, but the regex handles the /month negative lookahead.
  const filtered = matches.filter(m => {
    // Make sure we are not catching "stipend" around the match.
    return !m.toLowerCase().includes("stipend");
  });
  return Array.from(new Set(filtered));
}
