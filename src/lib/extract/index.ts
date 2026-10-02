import Anthropic from "@anthropic-ai/sdk";
import { ClaimsSchema, ClaimsInput } from "./claimsSchema";
import { buildMessage } from "./builder";
import { extractEmails, extractPhones, extractUrls, extractUpi, extractFeeWording, extractRole, extractPressureTactics } from "./regex";

interface MessagePayload {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: Anthropic.MessageCreateParams['messages'][0]['content'] }>;
}

async function callAnthropic(payload: MessagePayload): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set in environment");
  }
  if (!model) {
    throw new Error("ANTHROPIC_MODEL not set in environment");
  }
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature: 0,
    system: payload.system,
    messages: payload.messages,
  });
  // response could be a stream, but we didn't set stream: true, so it's a Message
  const msg = response as Anthropic.Message;
  const textBlock = msg.content.find((c) => c.type === "text");
  return textBlock && 'text' in textBlock ? textBlock.text : "";
}

type ExtractedBase = {
  transcript: string;
  platform: undefined;
  company: undefined;
  role: undefined;
  recruiterName: undefined;
  emails: string[];
  phones: string[];
  urls: string[];
  payment: { requested: boolean };
  pressureTactics: string[];
  stipend: undefined;
  location: undefined;
  confidence: Record<string, never>;
  extractionMode?: string;
  [key: string]: unknown;
};

function mergeResults(llmData: ClaimsInput | ExtractedBase, transcript: string, mode: "regex-only" | "llm+regex") {
  const regexData = {
    emails: extractEmails(transcript),
    phones: extractPhones(transcript),
    urls: extractUrls(transcript),
    upi: extractUpi(transcript),
    feeWording: extractFeeWording(transcript),
    role: extractRole(transcript),
    pressureTactics: extractPressureTactics(transcript),
  };
  const merged = { ...llmData, extractionMode: mode };
  if (regexData.emails.length) merged.emails = regexData.emails;
  if (regexData.phones.length) merged.phones = regexData.phones;
  if (regexData.urls.length) merged.urls = regexData.urls;
  if (regexData.role) merged.role = regexData.role;
  if (regexData.pressureTactics.length) merged.pressureTactics = regexData.pressureTactics;
  if (regexData.upi.length) {
    merged.payment = { ...(merged.payment ?? {}), method: regexData.upi[0], requested: true };
  }
  if (regexData.feeWording.length) {
    merged.payment = { ...(merged.payment ?? {}), requested: true, wording: regexData.feeWording.join("; ") };
  }
  return merged;
}

function getRegexOnlyBase(transcript: string) {
  return {
    transcript,
    platform: undefined,
    company: undefined,
    role: undefined,
    recruiterName: undefined,
    emails: [],
    phones: [],
    urls: [],
    payment: { requested: false },
    pressureTactics: [],
    stipend: undefined,
    location: undefined,
    confidence: {},
  };
}

export async function extractClaims(input: { text?: string; imageUrl?: string; regexOnly?: boolean }): Promise<ExtractedBase | (ClaimsInput & { extractionMode: string })> {
  const transcript = input.text || "";
  
  if (input.regexOnly) {
    const base = getRegexOnlyBase(transcript);
    return mergeResults(base, transcript, "regex-only");
  }

  const msgInput = input.imageUrl 
    ? { type: "image" as const, content: input.imageUrl } // This might need parsing to base64 if it's a URL, but let's assume builder handles it or we pass it properly
    : { type: "text" as const, content: transcript };
    
  if (input.imageUrl && input.imageUrl.startsWith("data:image/")) {
    const [, base64] = input.imageUrl.split(",");
    msgInput.content = base64;
  }
    
  const payload = buildMessage(msgInput);
  
  let rawJson = "";
  try {
    rawJson = await callAnthropic(payload);
  } catch (e) {
    const base = getRegexOnlyBase(transcript);
    return mergeResults(base, transcript, "regex-only");
  }

  let parsed: ClaimsInput | null = null;
  const tryParse = (str: string) => {
    try {
      const cleaned = str.replace(/```json\n?|```/g, "").trim();
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  };

  parsed = tryParse(rawJson);
  let result = parsed ? ClaimsSchema.safeParse(parsed) : null;

  if (!result || !result.success) {
    try {
      rawJson = await callAnthropic(payload);
      parsed = tryParse(rawJson);
      result = parsed ? ClaimsSchema.safeParse(parsed) : null;
    } catch (e) {
      const base = getRegexOnlyBase(transcript);
      return mergeResults(base, transcript, "regex-only");
    }
  }

  if (!result || !result.success) {
    const base = getRegexOnlyBase(transcript);
    return mergeResults(base, transcript, "regex-only");
  }

  return mergeResults(result.data, transcript, "llm+regex");
}
