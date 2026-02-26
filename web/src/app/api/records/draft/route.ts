export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { hashRecord, stableStringify } from "@/lib/hash";
import { structureEntry } from "@/lib/llm";
import type { CanonicalRecord, DraftRequest, DraftResponse } from "@/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as DraftRequest;

  if (!body.raw_text || !body.owner_pubkey) {
    return NextResponse.json(
      { error: "raw_text and owner_pubkey required" },
      { status: 400 },
    );
  }

  const created_at = new Date().toISOString();

  const canonical: CanonicalRecord = {
    owner_pubkey: body.owner_pubkey,
    created_at,
    raw_text: body.raw_text,
  };

  const record_json = stableStringify(canonical);
  const record_hash = hashRecord(canonical);

  // AI structuring (best-effort)
  const ai = await structureEntry(body.raw_text);

  const stmt = db.prepare(`
    INSERT INTO records (record_hash, owner_pubkey, created_at, raw_text, ai_json, record_json, status)
    VALUES (?, ?, ?, ?, ?, ?, 'draft')
  `);

  stmt.run(
    record_hash,
    body.owner_pubkey,
    created_at,
    body.raw_text,
    ai ? JSON.stringify(ai) : null,
    record_json,
  );

  const response: DraftResponse = {
    record_hash,
    record: canonical,
    ai,
  };

  return NextResponse.json(response);
}
