export const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// 10 digit numbers starting with 6-9, optional +91, 0, optional spaces/hyphens
export const phoneRegex = /(?:(?:\+91|0)?[\s-]?)?[6-9](?:\d{9}|\d{4}[\s-]?\d{5}|\d{2}[\s-]?\d{3}[\s-]?\d{4})\b/g;

// URL regex to match with or without http://, and short.link/apply
export const urlRegex = /(?:https?:\/\/)?(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b[-a-zA-Z0-9()@:%_+.~#?&//=]*/gi;

// UPI ID usually doesn't have a dot after the @
export const upiRegex = /\b[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}\b(?!\.[a-zA-Z])/g;

// Fees
export const feeWordingRegex = /(?:pay|payment|fee|charge|registration|deposit|send|transfer)[^.!?;]*(?:\b(?:₹|Rs\.?|INR)?\s?\d+[\d,]*)?/gi;

// Pressure tactics
export const pressureRegex = /\b(?:urgent|immediately|limited\s+slots|today\s+only|act\s+fast|hurry|final\s+warning)\b/gi;

// Roles (covers common Indian IT job titles)
export const roleRegex = /\b(?:software\s+engineer|systems?\s+engineer|developer|data\s+entry|data\s+analyst|data\s+scientist|(?:hr|marketing|sales|product|project)\s+manager|manager|analyst|designer|consultant|intern|associate|executive|architect|team\s+lead|tech\s+lead)\b/gi;

export function extractEmails(text: string): string[] {
  return Array.from(new Set(text.match(emailRegex) || []));
}

export function extractPhones(text: string): string[] {
  const matches = text.match(phoneRegex) || [];
  const cleaned = matches.map(m => m.trim());
  return Array.from(new Set(cleaned));
}

export function extractUrls(text: string): string[] {
  const matches = text.match(urlRegex) || [];
  const emails = extractEmails(text);
  const upis = extractUpi(text);
  const cleaned = matches.map((url) => {
    let cleanUrl = url.replace(/[.,;)]+$/, "");
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = "http://" + cleanUrl;
    }
    return cleanUrl;
  }).filter((url) => {
    // If the bare domain/path without http:// matches an email exactly, ignore it
    const bare = url.replace(/^https?:\/\//i, "");
    if (emails.includes(bare)) return false;
    
    // Also ignore if the bare domain is actually part of an extracted UPI ID
    if (upis.some(u => bare.includes(u))) return false;
    
    return true;
  });
  return Array.from(new Set(cleaned));
}

export function extractUpi(text: string): string[] {
  const matches = text.match(upiRegex) || [];
  const emails = extractEmails(text);
  // Exclude matches that are actually emails (e.g. if the regex missed the dot check somehow)
  const filtered = matches.filter(m => {
    if (emails.some(e => e.includes(m))) return false;
    return !m.includes(".com") && !m.includes(".in") && !m.includes(".org");
  });
  return Array.from(new Set(filtered));
}

export function extractFeeWording(text: string): string[] {
  const matches = text.match(feeWordingRegex) || [];
  const sentences = text.split(/[.!?\n]+/).map(s => s.trim().toLowerCase());
  
  const filtered = matches.filter((m) => {
    const mLower = m.toLowerCase();
    
    // Find which sentence this match belongs to
    const matchingSentence = sentences.find(s => s.includes(mLower));
    const context = matchingSentence || text.toLowerCase();
    
    // Ignore negative phrases in the SAME sentence
    if (context.includes("no fee") || context.includes("no fees") || context.includes("never ask candidates for money") || context.includes("free of charge")) {
      return false;
    }
    
    // Ignore stipends / salaries
    // Note: \bhr\b would false-positive on "hr@ybl" (UPI). Only match /hr or per hr.
    if (mLower.includes("stipend") || mLower.includes("salary") || mLower.includes("lpa") || mLower.match(/\b(?:month|yr|year|week|day|hour)\b/) || mLower.match(/(?:\/|per\s+)hr\b/)) {
      return false;
    }
    
    // Ignore "send/transfer email/resume/cv" - normal recruitment phrases, not payment
    if (/\b(?:send|transfer)\b/i.test(mLower) && /\b(?:email|resume|cv|application|details)\b/i.test(mLower)) {
      return false;
    }
    
    return true;
  });
  return Array.from(new Set(filtered));
}

export function extractPressureTactics(text: string): string[] {
  const matches = text.match(pressureRegex) || [];
  return Array.from(new Set(matches.map(m => m.toLowerCase())));
}

export function extractRole(text: string): string | undefined {
  const matches = text.match(roleRegex);
  return matches ? matches[0] : undefined;
}
