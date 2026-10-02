import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "../route";
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import { getSalt, hashIndicator } from "../../../../lib/redact";

const db = new PrismaClient();

describe("POST /api/report", () => {
  beforeEach(async () => {
    await db.report.deleteMany();
    await db.indicator.deleteMany();
    await db.claim.deleteMany();
    await db.scan.deleteMany();
  });

  const createReq = (body: unknown, ip = "127.0.0.1") => {
    return new Request("http://localhost/api/report", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify(body)
    });
  };

  it("valid report -> 200 and reportCount incremented", async () => {
    const indHash = hashIndicator({ type: "phone", normalizedValue: "9876543210" });
    const scan = await db.scan.create({
      data: {
        verdict: "UNVERIFIED",
        why: "",
        extractionMode: "regex-only",
        indicatorHashes: JSON.stringify([indHash])
      }
    });
    await db.indicator.create({
      data: { hash: indHash, type: "phone", scanCount: 1, reportCount: 0 }
    });

    const req = createReq({ passportId: scan.id, indicatorType: "phone", note: "Test note" }, "192.168.1.1");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const ind = await db.indicator.findUnique({ where: { hash: indHash } });
    expect(ind?.reportCount).toBe(1);
    const report = await db.report.findFirst({ where: { indicatorHash: indHash } });
    expect(report?.note).toBe("Test note");
  });

  it("same reporter + same indicator within 24h -> 200 and count unchanged", async () => {
    const indHash = hashIndicator({ type: "phone", normalizedValue: "9876543210" });
    const scan = await db.scan.create({
      data: { verdict: "UNVERIFIED", why: "", extractionMode: "regex-only", indicatorHashes: JSON.stringify([indHash]) }
    });
    await db.indicator.create({ data: { hash: indHash, type: "phone", scanCount: 1, reportCount: 1 } });
    
    const reporterHash = crypto.createHmac("sha256", getSalt()).update(`192.168.1.2:${indHash}`).digest("hex");
    await db.report.create({ data: { indicatorHash: indHash, type: "phone", reporterHash } });

    const req = createReq({ passportId: scan.id, indicatorType: "phone" }, "192.168.1.2");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const ind = await db.indicator.findUnique({ where: { hash: indHash } });
    expect(ind?.reportCount).toBe(1);
  });

  it("note > 300 chars -> 400", async () => {
    const req = createReq({ passportId: "00000000-0000-0000-0000-000000000000", indicatorType: "phone", note: "a".repeat(301) }, "192.168.1.3");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("note containing a phone number is stored redacted", async () => {
    const indHash = hashIndicator({ type: "phone", normalizedValue: "9876543210" });
    const scan = await db.scan.create({
      data: { verdict: "UNVERIFIED", why: "", extractionMode: "regex-only", indicatorHashes: JSON.stringify([indHash]) }
    });
    await db.indicator.create({ data: { hash: indHash, type: "phone", scanCount: 1, reportCount: 0 } });

    const req = createReq({ passportId: scan.id, indicatorType: "phone", note: "Call 9876543210" }, "192.168.1.4");
    const res = await POST(req);
    expect(res.status).toBe(200);

    const report = await db.report.findFirst({ where: { indicatorHash: indHash } });
    expect(report?.note).toContain("[PHONE]");
    expect(report?.note).not.toContain("9876543210");
  });

  it("unknown passportId -> 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const req = createReq({ passportId: fakeId, indicatorType: "phone" }, "192.168.1.5");
    const res = await POST(req);
    expect(res.status).toBe(404);
  });
});
