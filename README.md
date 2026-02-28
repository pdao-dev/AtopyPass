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

## Demo Flow
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
- **On-chain**: Memo Program only (no custom program deployment)

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
- Node.js 20+
- A Solana wallet (e.g., Phantom) set to **devnet**
- Devnet SOL for testing (`solana airdrop 2`)
- (Optional) LLM API key — AI 분석 없이도 기록/커밋/공유/철회 플로우는 동작합니다

### Install

```bash
cd web
npm install
```

### Configure env

```bash
cp .env.example .env.local
```

`.env.local`을 열고 필요한 값을 설정합니다:

```bash
# Solana (기본값 devnet — 수정 불필요)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_CLUSTER=devnet

# SQLite (기본값 — 수정 불필요)
SQLITE_PATH=./data/atopypass.db

# LLM (선택사항 — 비워두면 AI 분석 생략, 나머지 기능은 정상 동작)
LLM_API_KEY=
LLM_MODEL=gpt-4o-mini
```

### Run

```bash
cd web
npm run dev
```

브라우저에서:
- **사용자 페이지**: http://localhost:3000
- **의사 페이지**: http://localhost:3000/doctor

### Build (production)

```bash
cd web
npm run build
npm start
```

> Note: SQLite 네이티브 모듈 사용으로 API 라우트는 Node.js 런타임에서만 동작합니다 (Edge 미지원).

---

## Security & Privacy Notes

* **Never** store personal health text on-chain.
* On-chain: hashes + grant/revoke events only.
* AI is restricted to summarization & extraction (no diagnosis/medical instructions).

---

## Roadmap

* Client-side encryption for off-chain records (end-to-end sharing)
* N-of-1 personal experiments (protocol commit + result commit)
* Community trigger graph (optional)
* Research opt-in pools (consent-based)

---

## License

Apache 2.0 License
