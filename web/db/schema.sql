-- AtopyPass SQLite schema

CREATE TABLE IF NOT EXISTS records (
  record_hash   TEXT PRIMARY KEY,
  owner_pubkey  TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  raw_text      TEXT NOT NULL,
  ai_json       TEXT,
  record_json   TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'draft',
  tx_sig_record TEXT
);

CREATE TABLE IF NOT EXISTS consents (
  record_hash   TEXT NOT NULL,
  owner_pubkey  TEXT NOT NULL,
  doctor_pubkey TEXT NOT NULL,
  expiry_ts     INTEGER NOT NULL,
  revoked       INTEGER NOT NULL DEFAULT 0,
  tx_sig_last   TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  PRIMARY KEY (record_hash, doctor_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_consents_doctor
  ON consents (doctor_pubkey, revoked, expiry_ts);

CREATE INDEX IF NOT EXISTS idx_records_owner_time
  ON records (owner_pubkey, created_at);
