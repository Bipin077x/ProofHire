import { describe, it, expect, beforeEach } from "vitest";
import { GET } from "../[id]/route";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

describe("GET /api/passport/[id]", () => {
  beforeEach(async () => {
    await db.claim.deleteMany();
    await db.scan.deleteMany();
  });

  it("valid id -> 200 redacted passport", async () => {
    const scan = await db.scan.create({
      data: {
        verdict: "UNVERIFIED",
        why: "",
        extractionMode: "regex-only",
        redactedTranscript: "[PHONE]",
      }
    });

    const req = new Request(`http://localhost/api/passport/${scan.id}`);
    const res = await GET(req, { params: { id: scan.id } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(scan.id);
    expect(data.redactedTranscript).toBe("[PHONE]");
  });

  it("unknown id -> 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const req = new Request(`http://localhost/api/passport/${fakeId}`);
    const res = await GET(req, { params: { id: fakeId } });
    expect(res.status).toBe(404);
  });

  it("malformed id -> 400", async () => {
    const req = new Request(`http://localhost/api/passport/invalid-id`);
    const res = await GET(req, { params: { id: "invalid-id" } });
    expect(res.status).toBe(400);
  });
});
