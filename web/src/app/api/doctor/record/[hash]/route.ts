export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  const doctor = req.nextUrl.searchParams.get("doctor");

  if (!doctor) {
    return NextResponse.json({ error: "doctor query param required" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  // Check consent is valid
  const consent = db
    .prepare(
      `
      SELECT 1 FROM consents
      WHERE record_hash = ? AND doctor_pubkey = ? AND revoked = 0 AND expiry_ts > ?
    `,
    )
    .get(hash, doctor, now);

  if (!consent) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  const record = db
    .prepare(
      `
      SELECT record_hash, owner_pubkey, created_at, raw_text, ai_json, status
      FROM records WHERE record_hash = ? AND status = 'committed'
    `,
    )
    .get(hash) as Record<string, unknown> | undefined;

  if (!record) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  return NextResponse.json({ record });
}
