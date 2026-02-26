export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import type { DoctorRecordSummary, AiOutput } from "@/types";

export async function GET(req: NextRequest) {
  const doctor = req.nextUrl.searchParams.get("doctor");

  if (!doctor) {
    return NextResponse.json({ error: "doctor query param required" }, { status: 400 });
  }

  const now = Math.floor(Date.now() / 1000);

  const rows = db
    .prepare(
      `
      SELECT r.record_hash, r.owner_pubkey, r.created_at, r.ai_json
      FROM consents c
      JOIN records r ON r.record_hash = c.record_hash
      WHERE c.doctor_pubkey = ?
        AND c.revoked = 0
        AND c.expiry_ts > ?
        AND r.status = 'committed'
      ORDER BY r.created_at DESC
    `,
    )
    .all(doctor, now) as Array<{
      record_hash: string;
      owner_pubkey: string;
      created_at: string;
      ai_json: string | null;
    }>;

  const records: DoctorRecordSummary[] = rows.map((row) => {
    let ai_summary: string | undefined;
    if (row.ai_json) {
      try {
        const ai: AiOutput = JSON.parse(row.ai_json);
        ai_summary = ai.summary_ko;
      } catch {
        /* ignore */
      }
    }
    return {
      record_hash: row.record_hash,
      owner_pubkey: row.owner_pubkey,
      created_at: row.created_at,
      ai_summary,
    };
  });

  return NextResponse.json({ records });
}
