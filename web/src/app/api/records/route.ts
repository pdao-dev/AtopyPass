export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import type { UserRecord, ConsentInfo } from "@/types";

export async function GET(req: NextRequest) {
  const owner = req.nextUrl.searchParams.get("owner");

  if (!owner) {
    return NextResponse.json(
      { error: "owner query param required" },
      { status: 400 },
    );
  }

  const rows = db
    .prepare(
      `
      SELECT record_hash, created_at, raw_text, ai_json, status, tx_sig_record
      FROM records
      WHERE owner_pubkey = ?
      ORDER BY created_at DESC
    `,
    )
    .all(owner) as Array<{
    record_hash: string;
    created_at: string;
    raw_text: string;
    ai_json: string | null;
    status: "draft" | "committed";
    tx_sig_record: string | null;
  }>;

  const records: UserRecord[] = rows.map((row) => {
    const consents = db
      .prepare(
        `
        SELECT doctor_pubkey, expiry_ts, revoked
        FROM consents
        WHERE record_hash = ? AND owner_pubkey = ?
        ORDER BY updated_at DESC
      `,
      )
      .all(row.record_hash, owner) as ConsentInfo[];

    return { ...row, consents };
  });

  return NextResponse.json({ records });
}
