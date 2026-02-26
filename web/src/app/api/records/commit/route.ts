export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getConnection } from "@/lib/solana/tx";
import { parseMemo, MEMO_PROGRAM_ID } from "@/lib/solana/memo";
import type { CommitRequest } from "@/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CommitRequest;

  if (!body.record_hash || !body.owner_pubkey || !body.tx_sig) {
    return NextResponse.json(
      { error: "record_hash, owner_pubkey, and tx_sig required" },
      { status: 400 },
    );
  }

  // Verify the transaction on-chain
  const conn = getConnection();
  const txInfo = await conn.getTransaction(body.tx_sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!txInfo) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Find memo instruction and verify
  const accountKeys = txInfo.transaction.message.getAccountKeys();
  const instructions = txInfo.transaction.message.compiledInstructions;

  let memoData: string | null = null;
  for (const ix of instructions) {
    const programId = accountKeys.get(ix.programIdIndex);
    if (programId?.equals(MEMO_PROGRAM_ID)) {
      memoData = Buffer.from(ix.data).toString("utf-8");
      break;
    }
  }

  if (!memoData) {
    return NextResponse.json({ error: "No memo instruction found" }, { status: 400 });
  }

  const parsed = parseMemo(memoData);
  if (!parsed || parsed.action !== "RECORD") {
    return NextResponse.json({ error: "Invalid RECORD memo" }, { status: 400 });
  }

  if (parsed.record_hash !== body.record_hash) {
    return NextResponse.json({ error: "Hash mismatch" }, { status: 400 });
  }

  // Update DB
  const stmt = db.prepare(`
    UPDATE records SET status = 'committed', tx_sig_record = ?
    WHERE record_hash = ? AND owner_pubkey = ?
  `);
  const result = stmt.run(body.tx_sig, body.record_hash, body.owner_pubkey);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
