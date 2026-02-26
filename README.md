# AtopyPass (AP1)

Consent-first eczema (atopy) logging with AI summaries, plus on-chain integrity + grant/revoke access events on Solana.

> ⚠️ Not medical advice. AtopyPass does **not** diagnose, treat, or prescribe.  
> It’s a **tracking + summarization + consented sharing** tool.

---

## What is this?

Atopic dermatitis (eczema) management is highly personal: triggers differ per person, and the most valuable asset is **consistent, shareable logs**.

**AtopyPass** lets you:
1) Write a quick Korean chat-style log (“today was itchy after shower + new detergent…”)
2) Use AI to produce a **structured summary** (tags + questions for a doctor)
3) Store the full record **off-chain (SQLite)**
4) Anchor **record integrity** and **consent events** on Solana using the Memo program:
   - commit record hash
   - grant doctor access
   - revoke access

On-chain contains **no personal health text** — only hashes + consent events.

---

## MVP Demo Flow (what we show in the hackathon)
1. User connects wallet  
2. User submits a chat log  
3. AI shows:
   - 1-line summary
   - triggers/products/environment tags
   - 3 questions to ask a doctor
4. User clicks **Commit to Solana** → shows tx signature
5. User clicks **Share with Doctor (48h)** → shows tx signature
6. Doctor connects wallet on `/doctor` → sees the record
7. User clicks **Revoke** → doctor loses access (within polling interval)

---

## Key Features
- **Chat-based logging (Korean-friendly)**
- **Single-call AI extraction** (JSON only, no diagnosis)
- **Off-chain storage**: SQLite for speed + simplicity
- **On-chain proof & consent**: Solana Memo events
- **Doctor dashboard** gated by on-chain grant/revoke + expiry

---

## Architecture
- **Frontend**: Next.js (App Router) + TypeScript
- **Backend**: Next.js Route Handlers (Node runtime)
- **DB**: SQLite (`better-sqlite3`)
- **AI**: server-side LLM call (1 call per draft)
- **Solana**: `@solana/web3.js` + Wallet Adapter
- **On-chain**: Memo Program only (no program deployment for MVP)

### Why Solana?
Health data is less about “where it lives” and more about:
- **Integrity** (was this record changed?)
- **Consent** (who can see it, until when?)
- **Revocation** (can I take access back?)

We use Solana to record those non-sensitive events transparently.

---

## On-chain Protocol (MEMO) — MUST STAY EXACT

Memo payloads are UTF-8 strings separated by `|`.

- Record commit:
  - `AP1|RECORD|<record_hash_hex>`
- Grant consent:
  - `AP1|GRANT|<record_hash_hex>|<doctor_pubkey>|<expiry_ts>`
- Revoke consent:
  - `AP1|REVOKE|<record_hash_hex>|<doctor_pubkey>`

Where:
- `record_hash_hex` = sha256(canonical_record_json) as 64-char hex
- `expiry_ts` = unix epoch seconds

**No PII is allowed inside memos.**

Memo program id:
- `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`

---

## Data Storage (SQLite)

We store full records off-chain in SQLite, including:
- raw text
- AI JSON
- canonical record JSON string used for hashing
- status (draft/committed)
- tx signatures for auditability

Schema file:
- `db/schema.sql`

DB path:
- `SQLITE_PATH=./data/atopypass.db`

---

## API (server)

### `POST /api/records/draft`
Creates a draft record:
- calls LLM once
- builds canonical JSON
- returns `record_hash`

### `POST /api/records/commit`
Verifies an on-chain tx (memo + signer) and marks record as committed.

### `POST /api/consents/apply`
Verifies GRANT/REVOKE tx and updates consent index.

### `GET /api/doctor/records?doctor=<pubkey>`
Lists records accessible by the doctor.

### `GET /api/doctor/record/<hash>?doctor=<pubkey>`
Returns record JSON if consent is valid (not revoked, not expired).

---

## AI Output Schema (JSON only)

The model must return only JSON:
- `summary_ko` (string)
- `itch_score` (number|null)
- `triggers` (string[])
- `products` (string[])
- `environment` (string[])
- `doctor_questions_ko` (string[] length 3)

If parsing fails, we store `ai_json = null` and still keep the record draft.

---

## Getting Started

### Prerequisites
- Node.js 18+ (or 20+)
- A Solana wallet (e.g., Phantom) set to **devnet**
- Devnet SOL for testing (airdrop)
- LLM API key (server-side)

### Install
```bash
npm install
