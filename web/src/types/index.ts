// ── Shared types for AtopyPass (AP1) ──

/** AI structured output from LLM */
export interface AiOutput {
  summary_ko: string;
  itch_score: number | null;
  triggers: string[];
  products: string[];
  environment: string[];
  doctor_questions_ko: string[]; // length 3
}

/** DB row: records */
export interface RecordRow {
  record_hash: string;
  owner_pubkey: string;
  created_at: string; // ISO
  raw_text: string;
  ai_json: string | null; // JSON string
  record_json: string; // canonical JSON used for hashing
  status: "draft" | "committed";
  tx_sig_record: string | null;
}

/** DB row: consents */
export interface ConsentRow {
  record_hash: string;
  owner_pubkey: string;
  doctor_pubkey: string;
  expiry_ts: number;
  revoked: number; // 0 | 1
  tx_sig_last: string;
  updated_at: string; // ISO
}

/** Canonical record object – hashed to produce record_hash */
export interface CanonicalRecord {
  owner_pubkey: string;
  created_at: string; // ISO
  raw_text: string;
}

/** Memo protocol types */
export type MemoAction = "RECORD" | "GRANT" | "REVOKE";

export interface MemoRecord {
  action: "RECORD";
  record_hash: string;
}

export interface MemoGrant {
  action: "GRANT";
  record_hash: string;
  doctor_pubkey: string;
  expiry_ts: number;
}

export interface MemoRevoke {
  action: "REVOKE";
  record_hash: string;
  doctor_pubkey: string;
}

export type ParsedMemo = MemoRecord | MemoGrant | MemoRevoke;

// ── API request / response types ──

export interface DraftRequest {
  raw_text: string;
  owner_pubkey: string;
}

export interface DraftResponse {
  record_hash: string;
  record: CanonicalRecord;
  ai: AiOutput | null;
}

export interface CommitRequest {
  record_hash: string;
  owner_pubkey: string;
  tx_sig: string;
}

export interface ConsentApplyRequest {
  owner_pubkey: string;
  tx_sig: string;
}

export interface ConsentApplyResponse {
  ok: true;
  action: "GRANT" | "REVOKE";
  record_hash: string;
  doctor_pubkey: string;
  expiry_ts?: number;
}

export interface DoctorRecordSummary {
  record_hash: string;
  owner_pubkey: string;
  created_at: string;
  ai_summary?: string;
}

// ── User record list types ──

export interface ConsentInfo {
  doctor_pubkey: string;
  expiry_ts: number;
  revoked: number; // 0 | 1
}

export interface UserRecord {
  record_hash: string;
  created_at: string;
  raw_text: string;
  ai_json: string | null;
  status: "draft" | "committed";
  tx_sig_record: string | null;
  consents: ConsentInfo[];
}
