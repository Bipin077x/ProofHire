import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const db = new PrismaClient();

const idSchema = z.string().uuid();

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const parsed = idSchema.safeParse(params.id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const scan = await db.scan.findUnique({
    where: { id: parsed.data },
    include: { claims: true }
  });

  if (!scan) {
    return NextResponse.json({ error: "Passport not found" }, { status: 404 });
  }

  // The transcript is already redacted in the DB.
  return NextResponse.json(scan);
}
