import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { ClaimsSchema } from "../src/lib/extract/claimsSchema";
import { buildMessage } from "../src/lib/extract/builder";
import { extractEmails, extractPhones, extractUrls, extractUpi, extractFeeWording } from "../src/lib/extract/regex";

class ExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtractionError";
  }
}

function isExistingFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function readInput(arg: string): { type: "image" | "text" | "url"; content: string } {
  if (isExistingFile(arg)) {
    const ext = path.extname(arg).toLowerCase();
    const buffer = fs.readFileSync(arg);
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      return { type: "image", content: buffer.toString("base64") };
    }
    return { type: "text", content: buffer.toString("utf-8") };
  }
  if (/^https?:\/\//i.test(arg)) {
    return { type: "url", content: arg };
  }
  return { type: "text", content: arg };
}

async function callAnthropic(payload: any): Promise<string> {
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
    ...payload,
  });
  const textBlock = response.content.find((c: any) => c.type === "text");
  return textBlock && 'text' in textBlock ? textBlock.text : "";
}

function mergeResults(llmData: any, transcript: string, mode: "regex-only" | "llm+regex") {
  const regexData = {
    emails: extractEmails(transcript),
    phones: extractPhones(transcript),
    urls: extractUrls(transcript),
    upi: extractUpi(transcript),
    feeWording: extractFeeWording(transcript),
  };
  const merged = { ...llmData, extractionMode: mode };
  if (regexData.emails.length) merged.emails = regexData.emails;
  if (regexData.phones.length) merged.phones = regexData.phones;
  if (regexData.urls.length) merged.urls = regexData.urls;
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

async function main() {
  const args = process.argv.slice(2);
  const regexOnly = args.includes("--regex-only");
  const targetArg = args.find(a => !a.startsWith("--"));

  if (!targetArg) {
    console.error("Usage: npm run extract -- [--regex-only] <file-or-text-or-url>");
    process.exit(1);
  }
  
  let input;
  try {
    input = readInput(targetArg);
  } catch (e) {
    console.error("Failed to read input:", e);
    process.exit(1);
  }

  const transcript = typeof input.content === "string" && input.type !== "image" ? input.content : "";
  
  if (regexOnly) {
    const base = getRegexOnlyBase(transcript);
    const merged = mergeResults(base, transcript, "regex-only");
    console.log(JSON.stringify(merged, null, 2));
    return;
  }

  const payload = buildMessage(input);
  
  let rawJson = "";
  try {
    rawJson = await callAnthropic(payload);
  } catch (e) {
    console.warn("Anthropic call failed. Falling back to regex-only. Error:", (e as Error).message);
    const base = getRegexOnlyBase(transcript);
    const merged = mergeResults(base, transcript, "regex-only");
    console.log(JSON.stringify(merged, null, 2));
    return;
  }

  let parsed: any = null;
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
    console.warn("Parsing or validation failed, retrying once...");
    try {
      rawJson = await callAnthropic(payload);
    } catch (e) {
      console.warn("Retry Anthropic call failed. Falling back to regex-only.");
      const base = getRegexOnlyBase(transcript);
      const merged = mergeResults(base, transcript, "regex-only");
      console.log(JSON.stringify(merged, null, 2));
      return;
    }
    parsed = tryParse(rawJson);
    result = parsed ? ClaimsSchema.safeParse(parsed) : null;
  }

  if (!result || !result.success) {
    console.warn("Failed to extract valid JSON from LLM output after retry. Falling back to regex-only.");
    const base = getRegexOnlyBase(transcript);
    const merged = mergeResults(base, transcript, "regex-only");
    console.log(JSON.stringify(merged, null, 2));
    return;
  }

  const merged = mergeResults(result.data, transcript, "llm+regex");
  console.log(JSON.stringify(merged, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
