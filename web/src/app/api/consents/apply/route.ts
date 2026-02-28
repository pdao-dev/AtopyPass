export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getConnection } from "@/lib/solana/tx";
import { parseMemo, MEMO_PROGRAM_ID } from "@/lib/solana/memo";
import type { ConsentApplyRequest, ConsentApplyResponse } from "@/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as ConsentApplyRequest;

  if (!body.owner_pubkey || !body.tx_sig) {
    return NextResponse.json(
      { error: "owner_pubkey and tx_sig required" },
      { status: 400 },
    );
  }

  // Verify the transaction on-chain
  const conn = getConnection();
  let txInfo;
  try {
    txInfo = await conn.getTransaction(body.tx_sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
  } catch {
    return NextResponse.json({ error: "Invalid transaction signature" }, { status: 400 });
  }

  if (!txInfo) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Verify tx signer matches owner_pubkey
  const accountKeys = txInfo.transaction.message.getAccountKeys();
  const signer = accountKeys.get(0);
  if (!signer || signer.toBase58() !== body.owner_pubkey) {
    return NextResponse.json({ error: "Signer mismatch" }, { status: 403 });
  }

  // Find memo instruction
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
  if (!parsed || parsed.action === "RECORD") {
    return NextResponse.json({ error: "Expected GRANT or REVOKE memo" }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (parsed.action === "GRANT") {
    const stmt = db.prepare(`
      INSERT INTO consents (record_hash, owner_pubkey, doctor_pubkey, expiry_ts, revoked, tx_sig_last, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(record_hash, doctor_pubkey) DO UPDATE SET
        expiry_ts = excluded.expiry_ts,
        revoked = 0,
        tx_sig_last = excluded.tx_sig_last,
        updated_at = excluded.updated_at
    `);
    stmt.run(
      parsed.record_hash,
      body.owner_pubkey,
      parsed.doctor_pubkey,
      parsed.expiry_ts,
      body.tx_sig,
      now,
    );

    const response: ConsentApplyResponse = {
      ok: true,
      action: "GRANT",
      record_hash: parsed.record_hash,
      doctor_pubkey: parsed.doctor_pubkey,
      expiry_ts: parsed.expiry_ts,
    };
    return NextResponse.json(response);
  }

  // REVOKE
  const stmt = db.prepare(`
    UPDATE consents SET revoked = 1, tx_sig_last = ?, updated_at = ?
    WHERE record_hash = ? AND doctor_pubkey = ? AND owner_pubkey = ?
  `);
  stmt.run(body.tx_sig, now, parsed.record_hash, parsed.doctor_pubkey, body.owner_pubkey);

  const response: ConsentApplyResponse = {
    ok: true,
    action: "REVOKE",
    record_hash: parsed.record_hash,
    doctor_pubkey: parsed.doctor_pubkey,
  };
  return NextResponse.json(response);
}
