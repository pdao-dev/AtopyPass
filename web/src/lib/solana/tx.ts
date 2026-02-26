import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID, buildRecordMemo, buildGrantMemo, buildRevokeMemo } from "./memo";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.devnet.solana.com";

export function getConnection(): Connection {
  return new Connection(RPC_URL, "confirmed");
}

/** Create a memo instruction from a string payload */
function memoIx(payload: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(payload, "utf-8"),
  });
}

/** Build a RECORD commit transaction (unsigned) */
export async function buildRecordTx(
  recordHash: string,
  payer: PublicKey,
): Promise<Transaction> {
  const conn = getConnection();
  const tx = new Transaction();
  tx.add(memoIx(buildRecordMemo(recordHash), payer));
  tx.feePayer = payer;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  return tx;
}

/** Build a GRANT consent transaction (unsigned) */
export async function buildGrantTx(
  recordHash: string,
  doctorPubkey: string,
  expiryTs: number,
  payer: PublicKey,
): Promise<Transaction> {
  const conn = getConnection();
  const tx = new Transaction();
  tx.add(memoIx(buildGrantMemo(recordHash, doctorPubkey, expiryTs), payer));
  tx.feePayer = payer;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  return tx;
}

/** Build a REVOKE consent transaction (unsigned) */
export async function buildRevokeTx(
  recordHash: string,
  doctorPubkey: string,
  payer: PublicKey,
): Promise<Transaction> {
  const conn = getConnection();
  const tx = new Transaction();
  tx.add(memoIx(buildRevokeMemo(recordHash, doctorPubkey), payer));
  tx.feePayer = payer;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  return tx;
}
