import { NextResponse } from "next/server";
import { z } from "zod";
import { AnalyzeResult } from "../../../lib/analyze";
import { RateLimiter, InMemoryRateLimiter } from "../../../lib/rate-limit";
import { redactText, extractIndicatorsFromText, hashIndicator } from "../../../lib/redact";
import { resolveCompanyFromDomains } from "../../../lib/verify/data/companies";
import { FREE_MAIL_PROVIDERS } from "../../../lib/verify/contact";
import { getHostFromEmailOrUrl } from "../../../lib/verify/domain";
import { ClaimKey } from "../../../lib/verify/types";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs";

const defaultLimiter = new InMemoryRateLimiter();
const defaultDb = new PrismaClient();

const analyzeJsonSchema = z.object({
  text: z.string().optional(),
  url: z.string().url().optional(),
}).refine(data => data.text || data.url, {
  message: "Either text or url must be provided",
});

function checkImageMagicBytes(buffer: Buffer): "png" | "jpeg" | "webp" | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return "png";
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return "jpeg";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) return "webp";
  return null;
}

export interface RouteDeps {
  rateLimiter: RateLimiter;
  db: PrismaClient;
  analyzePost: (text: string, imageUrl?: string) => Promise<AnalyzeResult>;
  safeResolve: (url: string) => Promise<{ error?: string; blocked?: { reason: string }; finalUrl?: string }>;
}

export async function handleAnalyzeRequest(req: Request, deps: RouteDeps) {
  let ip = "127.0.0.1";
  if (process.env.TRUSTED_PROXY === "true") {
    ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || ip;
  } else {
    ip = req.headers.get("x-real-ip") || ip; // fallback for tests/dev
  }

  const rateLimit = await deps.rateLimiter.consume(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { 
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfter || 60) }
    });
  }

  const contentType = req.headers.get("content-type") || "";
  let text = "";
  let url = "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await req.formData();
      const file = formData.get("image") as File | null;
      if (!file) {
         return NextResponse.json({ error: "No image file provided" }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
         return NextResponse.json({ error: "Payload Too Large" }, { status: 413 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const format = checkImageMagicBytes(buffer);
      if (!format) {
         return NextResponse.json({ error: "Unsupported Media Type" }, { status: 415 });
      }
      // Assuming analyzePost takes a base64 data URI for imageUrl
      const b64 = buffer.toString("base64");
      const imageUrl = `data:image/${format};base64,${b64}`;
      text = "";
      
      const result = await deps.analyzePost(text, imageUrl);
      return await storeAndReturn(result, deps.db, text);
    } catch (e) {
      return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
    }
  } else if (contentType.includes("application/json")) {
    try {
      const body = await req.json();
      const parsed = analyzeJsonSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
      }
      
      if (parsed.data.url) {
         url = parsed.data.url;
         const resolveResult = await deps.safeResolve(url);
         if (resolveResult.error || resolveResult.blocked) {
           return NextResponse.json({ error: "URL blocked or unreachable" }, { status: 400 });
         }
         // A URL-only input goes to safeResolve only; never fetch or parse page content.
         // Return basic passport for verified URL.
         const result: AnalyzeResult = {
           extracted: {
             transcript: "",
             urls: [resolveResult.finalUrl || url]
           },
           rollup: { verdict: "UNVERIFIED", reasons: [] },
           passport: []
         };
         return await storeAndReturn(result, deps.db, "");
      } else {
         text = parsed.data.text || "";
         const result = await deps.analyzePost(text);
         if (result.status && result.status >= 400) {
           return NextResponse.json({ error: result.error }, { status: result.status });
         }
         return await storeAndReturn(result, deps.db, text);
      }
    } catch (e) {
      console.error("Error in JSON path:", e);
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "Unsupported Media Type" }, { status: 415 });
  }
}

async function storeAndReturn(result: AnalyzeResult, db: PrismaClient, rawText: string) {
  const redacted = redactText(rawText);
  const extractionMode = result.extracted?.extractionMode || "regex-only";
  const indicators = extractIndicatorsFromText(rawText);
  
  let hasReportsRISK = false;
  let hasReportsUNCLEAR = false;
  let reportsUnclearCount = 0;

  for (const ind of indicators) {
    const hash = hashIndicator(ind);
    const existing = await db.indicator.findUnique({ where: { hash }, include: { _count: { select: { Report: true } } } });
    if (existing) {
      await db.indicator.update({
        where: { hash },
        data: { scanCount: { increment: 1 }, lastSeen: new Date() }
      });
      
      const rCount = existing._count.Report;
      if (rCount > 0) {
        let ignoreReports = false;
        if (ind.type === "email" || ind.type === "domain") {
          const host = getHostFromEmailOrUrl(ind.normalizedValue);
          if (host) {
            if (FREE_MAIL_PROVIDERS.includes(host)) {
              ignoreReports = true;
            } else {
              const { company } = resolveCompanyFromDomains([host]);
              if (company) ignoreReports = true;
            }
          }
        }
        
        if (!ignoreReports) {
          if (rCount >= 3) {
            hasReportsRISK = true;
          } else {
            hasReportsUNCLEAR = true;
            reportsUnclearCount = Math.max(reportsUnclearCount, rCount);
          }
        }
      }
    } else {
      await db.indicator.create({
        data: {
          hash,
          type: ind.type,
          scanCount: 1
        }
      });
    }
  }

  const passport = result.passport || [];
  if (hasReportsRISK) {
    passport.push({
      claim: "reports" as ClaimKey,
      status: "RISK",
      evidence: "Reported 3 or more times by distinct users",
      ruleId: "reports.known_indicator",
      sources: []
    });
  } else if (hasReportsUNCLEAR) {
    passport.push({
      claim: "reports" as ClaimKey,
      status: "UNCLEAR",
      evidence: `Reported ${reportsUnclearCount} time(s); below the confirmation threshold`,
      ruleId: "reports.unconfirmed",
      sources: []
    });
  }

  const { calculateRollup } = await import("../../../lib/rollup");
  const finalRollup = calculateRollup(passport);

  const scan = await db.scan.create({
    data: {
      verdict: finalRollup.verdict,
      why: finalRollup.reasons.join("; "),
      extractionMode,
      redactedTranscript: redacted,
      indicatorHashes: JSON.stringify(indicators.map(i => hashIndicator(i))),
      claims: {
        create: passport.map(p => ({
          key: p.claim,
          status: p.status,
          evidence: p.evidence,
          ruleId: p.ruleId,
          nextAction: p.nextAction,
          limitations: p.limitations,
          sourcesJson: p.sources ? JSON.stringify(p.sources) : null
        }))
      }
    }
  });

  return NextResponse.json({ passportId: scan.id });
}

export async function POST(req: Request) {
  const { analyzePost } = await import("../../../lib/analyze");
  const { safeResolve } = await import("../../../lib/safe-fetch");
  
  return handleAnalyzeRequest(req, {
    rateLimiter: defaultLimiter,
    db: defaultDb,
    analyzePost,
    safeResolve
  });
}
