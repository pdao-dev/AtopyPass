## Project: AtopyPass (AP1)
A hackathon MVP that lets users log atopic dermatitis (eczema) status via chat, uses AI to summarize/structure entries, and anchors integrity + consent (grant/revoke) on Solana.

**MVP principle**
- Off-chain stores the actual record JSON (SQLite).
- On-chain stores ONLY non-sensitive proof/consent events (hash + grant/revoke).
- No medical diagnosis. AI is used for summarization/tagging/question generation only.

---

## Non-goals (hard constraints)
- Do NOT put any personal health info on-chain (no symptoms text, no products, no photos).
- Do NOT provide medical advice or diagnosis.
- Do NOT change the memo protocol without updating both builders + server verifier.

---

## Tech stack (recommended)
- Next.js (App Router) + TypeScript
- Solana: `@solana/web3.js`, wallet adapter
- DB: SQLite (local file) via `better-sqlite3`
- AI: any LLM provider (server-side call), 1-call JSON output

**Runtime note**
- API routes MUST run on Node.js runtime (not Edge) because SQLite native modules.
- In Next.js route handlers, set `export const runtime = "nodejs"` where needed.

---

## Repo layout (suggested)
- `app/` UI routes
  - `app/page.tsx` user
  - `app/doctor/page.tsx` doctor
  - `app/api/**` route handlers
- `lib/`
  - `lib/hash.ts` stable stringify + sha256
  - `lib/solana/memo.ts` memo builder & parser
  - `lib/solana/tx.ts` tx builders
  - `lib/db.ts` sqlite connection + migrations
  - `lib/llm.ts` LLM call + JSON parsing
- `db/`
  - `db/schema.sql` sqlite DDL
- `types/` shared types

Keep solana protocol logic in `lib/solana/*` so FE/BE share it.

---

## Solana protocol (MEMO) — MUST STAY EXACT
Memo payloads are ASCII/UTF-8 strings with `|` separators.

- Record commit:
  - `AP1|RECORD|<record_hash_hex>`
- Grant consent:
  - `AP1|GRANT|<record_hash_hex>|<doctor_pubkey>|<expiry_ts>`
- Revoke consent:
  - `AP1|REVOKE|<record_hash_hex>|<doctor_pubkey>`

Notes:
- `record_hash_hex` is SHA-256 of the canonical record JSON (hex string, 64 chars).
- `expiry_ts` is Unix epoch seconds.
- No PII in memos.

---

## Data model (SQLite)
### Table: `records`
- `record_hash` TEXT PRIMARY KEY
- `owner_pubkey` TEXT NOT NULL
- `created_at` TEXT NOT NULL          -- ISO string used in the hash
- `raw_text` TEXT NOT NULL
- `ai_json` TEXT                      -- JSON string or NULL
- `record_json` TEXT NOT NULL         -- canonical JSON string used for hashing
- `status` TEXT NOT NULL DEFAULT 'draft'  -- 'draft'|'committed'
- `tx_sig_record` TEXT               -- tx signature for AP1|RECORD

### Table: `consents`
- `record_hash` TEXT NOT NULL
- `owner_pubkey` TEXT NOT NULL
- `doctor_pubkey` TEXT NOT NULL
- `expiry_ts` INTEGER NOT NULL
- `revoked` INTEGER NOT NULL DEFAULT 0    -- 0/1
- `tx_sig_last` TEXT NOT NULL
- `updated_at` TEXT NOT NULL              -- ISO
Primary key: `(record_hash, doctor_pubkey)`

Recommended indices:
- `idx_consents_doctor` on `(doctor_pubkey, revoked, expiry_ts)`
- `idx_records_owner_time` on `(owner_pubkey, created_at)`

---

## API contract (stable)
### POST `/api/records/draft`
Request:
- `{ raw_text: string, owner_pubkey: string }`
Response:
- `{ record_hash: string, record: object, ai: object|null }`

### POST `/api/records/commit`
Request:
- `{ record_hash: string, owner_pubkey: string, tx_sig: string }`
Response:
- `{ ok: true }`

### POST `/api/consents/apply`
Request:
- `{ owner_pubkey: string, tx_sig: string }`
Response:
- `{ ok: true, action: "GRANT"|"REVOKE", record_hash: string, doctor_pubkey: string, expiry_ts?: number }`

### GET `/api/doctor/records?doctor=<pubkey>`
Response:
- `{ records: Array<{ record_hash: string, owner_pubkey: string, created_at: string, ai_summary?: string }> }`

### GET `/api/doctor/record/<hash>?doctor=<pubkey>`
Response:
- `{ record: object }` (only if consent valid)

---

## LLM (AI) output schema (must be JSON only)
AI must return ONLY JSON with these keys:
- `summary_ko` (string)
- `itch_score` (number|null)
- `triggers` (string[])
- `products` (string[])
- `environment` (string[])
- `doctor_questions_ko` (string[] length 3)

If AI fails, store `ai_json = null` and continue.

---

## Environment variables
- `NEXT_PUBLIC_SOLANA_RPC_URL` (devnet endpoint)
- `NEXT_PUBLIC_SOLANA_CLUSTER` (`devnet`)
- `SQLITE_PATH` (e.g. `./data/atopypass.db`)
- `LLM_API_KEY` (server only)
- `LLM_MODEL` (optional)

Never expose server secrets to client.

---

## Coding rules
- TypeScript strict, avoid `any`.
- No new heavy dependencies unless absolutely necessary.
- Prefer small, reviewable commits.
- Ensure memo parsing/verifying is robust:
  - Verify memo program id
  - Extract memo string
  - Validate prefix `AP1|`
  - Validate hash length and hex charset
  - Validate pubkey format
  - Validate expiry_ts numeric (for GRANT)
- SQLite rules:
  - Use WAL mode if possible
  - Wrap writes in transactions where needed
  - Ensure DB directory exists (`./data`)

---

## Roles (humans)
- 주영: Frontend + UX + demo polish
- 진형: Backend + SQLite + AI + tx verification
- 현재: Solana protocol + tx builders

---

## Definition of Done (MVP)
1) User logs text -> AI summary shown
2) User commits record hash on Solana (tx link shown)
3) User grants doctor access (tx link shown)
4) Doctor can view record
5) User revokes and doctor view is denied (within polling interval)
