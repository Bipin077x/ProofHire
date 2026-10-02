import { NextResponse } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { getSalt, redactText, extractIndicatorsFromText, hashIndicator } from "../../../lib/redact";
import crypto from "crypto";
import { RateLimiter, InMemoryRateLimiter } from "../../../lib/rate-limit";

export const runtime = "nodejs";

const db = new PrismaClient();
const limiter = new InMemoryRateLimiter(Date.now, 10, 10, 24 * 60 * 60 * 1000);

const reportSchema = z.object({
  passportId: z.string().uuid(),
  indicatorType: z.enum(["domain", "upi", "phone", "email", "shortener"]),
  note: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  let ip = "127.0.0.1";
  if (process.env.TRUSTED_PROXY === "true") {
    ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || ip;
  } else {
    ip = req.headers.get("x-real-ip") || ip;
  }

  const rateLimit = await limiter.consume(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { 
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfter || 60) }
    });
  }

  try {
    const body = await req.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues }, { status: 400 });
    }

    const { passportId, indicatorType, note } = parsed.data;

    const scan = await db.scan.findUnique({ where: { id: passportId } });
    if (!scan) {
      return NextResponse.json({ error: "Passport not found" }, { status: 404 });
    }

    const hashes: string[] = scan.indicatorHashes ? JSON.parse(scan.indicatorHashes) : [];
    
    // Find an indicator of the requested type that was part of this scan
    let targetHash: string | null = null;
    for (const hash of hashes) {
      const ind = await db.indicator.findUnique({ where: { hash } });
      if (ind && ind.type === indicatorType) {
        targetHash = hash;
        break;
      }
    }

    if (!targetHash) {
      return NextResponse.json({ error: "No matching indicator found in this scan" }, { status: 404 });
    }

    const reporterHash = crypto.createHmac("sha256", getSalt())
      .update(`${ip}:${targetHash}`)
      .digest("hex");

    // Check if reported in last 24h
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentReport = await db.report.findFirst({
      where: {
        indicatorHash: targetHash,
        reporterHash,
        createdAt: { gte: oneDayAgo }
      }
    });

    if (recentReport) {
      return NextResponse.json({ error: "Already reported recently" }, { status: 409 });
    }

    await db.report.create({
      data: {
        indicatorHash: targetHash,
        type: indicatorType,
        note: note ? redactText(note) : undefined,
        reporterHash
      }
    });

    await db.indicator.update({
      where: { hash: targetHash },
      data: { reportCount: { increment: 1 } }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
