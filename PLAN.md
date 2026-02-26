## 0) Objective
Build a 1–2 day MVP that demonstrates:
- AI-powered chat logging (summarize + structure)
- Off-chain record storage (SQLite)
- On-chain proof (record hash) + consent events (grant/revoke) on Solana
- A doctor dashboard that visibly loses access after revoke

**Key product framing**
- Management & tracking tool (NOT cure)
- “Not medical advice” guardrails

---

## 1) MVP Scope (Must Ship)
### User flow (happy path)
1. User connects wallet
2. User enters a Korean chat log about today’s symptoms/exposures
3. Server creates a draft:
   - calls LLM once
   - returns AI summary/tags/questions
   - generates canonical record JSON and `record_hash` (sha256)
4. User signs & sends a Solana tx with Memo: `AP1|RECORD|<hash>`
5. Server verifies tx and marks record as committed
6. User shares with doctor:
   - signs Solana tx memo: `AP1|GRANT|<hash>|<doctor>|<expiry>`
   - server verifies and updates consent index
7. Doctor connects wallet and can view shared records
8. User revokes:
   - signs tx memo: `AP1|REVOKE|<hash>|<doctor>`
   - doctor loses access within polling window

### Out of scope
- Diagnosis/treatment advice
- On-chain storage of record content
- Photo encryption (optional stretch)

---

## 2) Protocol (Memos) — DO NOT CHANGE
- `AP1|RECORD|<record_hash_hex>`
- `AP1|GRANT|<record_hash_hex>|<doctor_pubkey>|<expiry_ts>`
- `AP1|REVOKE|<record_hash_hex>|<doctor_pubkey>`

Rationale:
- Ultra-fast build (no program deployment)
- Still clearly “on-chain events” with tx links in demo
- Server acts as lightweight indexer by verifying txs once

---

## 3) Data / Hashing
### Canonical record JSON (example)
```json
{
  "schema_version": "ap1",
  "owner_pubkey": "....",
  "created_at": "2026-02-26T12:34:56.000Z",
  "raw_text": "어제 새 세제 쓰고 샤워 후 가려움 8...",
  "ai": {
    "summary_ko": "...",
    "itch_score": 8,
    "triggers": ["새 세제", "뜨거운 샤워"],
    "products": ["세제"],
    "environment": ["건조"],
    "doctor_questions_ko": ["...", "...", "..."]
  },
  "meta": { "locale": "ko-KR", "source": "chat" }
}
````

### Hash rule

* Use stable/canonical stringify (key order deterministic)
* `record_hash = sha256(canonical_json_string)` => hex(64 chars)
* Store `record_json` exactly as the canonical string used for hashing in SQLite

Never include `record_hash` inside the hashed object itself.

---

## 4) SQLite Setup

### Library

* Use `better-sqlite3` for fastest MVP (sync, simple).
* Ensure API routes run on Node runtime:

  * `export const runtime = "nodejs"`

### DB file

* `SQLITE_PATH=./data/atopypass.db`
* Create `./data` directory if missing.

### Pragmas (recommended)

* `PRAGMA journal_mode = WAL;`
* `PRAGMA foreign_keys = ON;`

---

## 5) DB Schema (SQLite)

Create `db/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS records (
  record_hash   TEXT PRIMARY KEY,
  owner_pubkey  TEXT NOT NULL,
  created_at    TEXT NOT NULL,     -- ISO string used in the hash
  raw_text      TEXT NOT NULL,
  ai_json       TEXT,              -- JSON string or NULL
  record_json   TEXT NOT NULL,     -- canonical JSON string used for hashing
  status        TEXT NOT NULL DEFAULT 'draft',  -- draft|committed
  tx_sig_record TEXT
);

CREATE TABLE IF NOT EXISTS consents (
  record_hash  TEXT NOT NULL,
  owner_pubkey TEXT NOT NULL,
  doctor_pubkey TEXT NOT NULL,
  expiry_ts    INTEGER NOT NULL,
  revoked      INTEGER NOT NULL DEFAULT 0,
  tx_sig_last  TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (record_hash, doctor_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_consents_doctor
  ON consents (doctor_pubkey, revoked, expiry_ts);

CREATE INDEX IF NOT EXISTS idx_records_owner_time
  ON records (owner_pubkey, created_at);
```

---

## 6) API Endpoints

### POST `/api/records/draft`

Input:

* `raw_text`
* `owner_pubkey`
  Steps:

1. call LLM (1x)
2. construct canonical record object (see section 3)
3. stable stringify -> `record_json`
4. sha256(record_json) -> `record_hash`
5. INSERT OR REPLACE into `records` with status='draft'
   Output:

* `record_hash`
* `record` (parsed object)
* `ai` (parsed AI JSON or null)

### POST `/api/records/commit`

Input:

* `record_hash`, `owner_pubkey`, `tx_sig`
  Steps:

1. fetch tx from Solana
2. verify memo matches `AP1|RECORD|record_hash`
3. verify signer includes `owner_pubkey`
4. update record: status='committed', tx_sig_record=tx_sig
   Output: `{ ok: true }`

### POST `/api/consents/apply`

Input:

* `owner_pubkey`, `tx_sig`
  Steps:

1. fetch tx from Solana
2. parse memo: GRANT or REVOKE
3. verify signer includes `owner_pubkey`
4. update `consents`:

   * GRANT: upsert expiry_ts, revoked=0, tx_sig_last
   * REVOKE: set revoked=1, tx_sig_last
     Output: `{ ok: true, action, record_hash, doctor_pubkey, expiry_ts? }`

### GET `/api/doctor/records?doctor=<pubkey>`

Logic:

* return records where consent valid:

  * consents.doctor_pubkey = doctor
  * revoked=0
  * expiry_ts > now()
  * records.status='committed'
    Output:
* list minimal fields (hash, created_at, owner_pubkey, ai_summary optional)

### GET `/api/doctor/record/<hash>?doctor=<pubkey>`

Logic:

* verify consent valid (same conditions)
* return `record` JSON by parsing `records.record_json`
  Output:
* `{ record: {...} }`

---

## 7) Solana Implementation Notes

### Memo program id

* `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`

### Tx building (client)

* Add memo instruction with data = memo string bytes (utf8)
* Send via wallet adapter
* Show signature and explorer link

### Tx verification (server)

* `getTransaction(txSig, { maxSupportedTransactionVersion: 0 })`
* Find instructions with programId == Memo program id
* Decode data to utf8 string
* Parse:

  * split by `|`
  * validate prefix + field counts
* Verify `owner_pubkey` is a signer in the tx message

---

## 8) AI Prompt (server-side)

### Policy

* No diagnosis, no treatment advice.
* Only summarize and extract structured fields.
* Output MUST be pure JSON, no markdown.

### Output schema

Keys:

* summary_ko
* itch_score
* triggers[]
* products[]
* environment[]
* doctor_questions_ko[] (length 3)

Failure mode:

* If parsing fails -> ai_json=null, still create draft record.

---

## 9) Team Execution Plan (2-day)

## Day 0 (30–60 min): Alignment + Repo bootstrap

* Confirm memo protocol + API contract + SQLite schema (do not change)
* Create repo, add dependencies, env sample
* Create `db/schema.sql`, `lib/db.ts` (runs schema on boot)

## Day 1: Must-ship MVP

### 주영 (Frontend)

* Scaffold pages `/` and `/doctor`
* Wallet connect + tx send (commit/grant/revoke)
* Integrate API calls + state badges + explorer links

### 진형 (Backend/AI)

* SQLite schema + route handlers for draft/commit/consent/doctor read
* LLM call + JSON parsing robustly
* Tx verification logic for memos

### 현재 (Solana)

* Build memo tx builder + memo parser utilities in `lib/solana`
* Provide sample memo verification snippet to backend
* Standardize explorer link helper

**Integration checkpoint (end of Day 1)**

* End-to-end: user draft -> commit tx -> commit API -> grant tx -> doctor list shows -> revoke tx -> doctor loses access

## Day 2: Polish + Demo power

* Add “7-day summary” endpoint/page (optional)
* Add sample data button
* Improve UX: loading/error states, empty states
* Prepare demo script + 60s pitch
* If time remains: Anchor consent program stretch (only if MVP stable)

---

## 10) Risks & Fallbacks

### Risk: Solana tx fetching slow / RPC flaky

Fallback:

* Use a stable devnet RPC
* Cache tx verification results by signature in SQLite

### Risk: AI output invalid JSON

Fallback:

* Strict prompt + retry once
* If still fails: ai_json=null and continue

### Risk: Memo parsing mismatch

Fallback:

* Centralize memo build/parse in shared `lib/solana/memo.ts`
* Add validation checks (hash length, prefix, fields)

---

## 11) Demo Script (60–90 seconds)

1. User wallet connect
2. Paste sample log text
3. AI summary card appears
4. Click commit -> show devnet explorer link
5. Share with doctor 48h -> show explorer link
6. Open doctor page -> record visible
7. Revoke -> doctor record disappears after polling

---

## 12) Definition of Done (ship criteria)

* E2E flow works without manual DB edits
* All on-chain events have explorer links
* Doctor access strictly controlled by consent validity
* No PII stored on-chain
* Clear “not medical advice” disclaimers
