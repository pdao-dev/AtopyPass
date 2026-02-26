import { PublicKey } from "@solana/web3.js";
import type { ParsedMemo } from "@/types";

const PREFIX = "AP1";
const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export { MEMO_PROGRAM_ID };

// ── Builders ──

export function buildRecordMemo(recordHash: string): string {
  return `${PREFIX}|RECORD|${recordHash}`;
}

export function buildGrantMemo(
  recordHash: string,
  doctorPubkey: string,
  expiryTs: number,
): string {
  return `${PREFIX}|GRANT|${recordHash}|${doctorPubkey}|${expiryTs}`;
}

export function buildRevokeMemo(
  recordHash: string,
  doctorPubkey: string,
): string {
  return `${PREFIX}|REVOKE|${recordHash}|${doctorPubkey}`;
}

// ── Parser ──

const HEX_64 = /^[0-9a-f]{64}$/;

function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

export function parseMemo(memo: string): ParsedMemo | null {
  const parts = memo.split("|");
  if (parts[0] !== PREFIX) return null;

  const action = parts[1];

  if (action === "RECORD" && parts.length === 3) {
    const hash = parts[2];
    if (!HEX_64.test(hash)) return null;
    return { action: "RECORD", record_hash: hash };
  }

  if (action === "GRANT" && parts.length === 5) {
    const hash = parts[2];
    const doctor = parts[3];
    const expiry = Number(parts[4]);
    if (!HEX_64.test(hash)) return null;
    if (!isValidPubkey(doctor)) return null;
    if (!Number.isFinite(expiry) || expiry <= 0) return null;
    return {
      action: "GRANT",
      record_hash: hash,
      doctor_pubkey: doctor,
      expiry_ts: expiry,
    };
  }

  if (action === "REVOKE" && parts.length === 4) {
    const hash = parts[2];
    const doctor = parts[3];
    if (!HEX_64.test(hash)) return null;
    if (!isValidPubkey(doctor)) return null;
    return { action: "REVOKE", record_hash: hash, doctor_pubkey: doctor };
  }

  return null;
}
