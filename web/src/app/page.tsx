"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { DraftResponse, AiOutput } from "@/types";

export default function UserPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [status, setStatus] = useState("");

  async function handleDraft() {
    if (!publicKey || !rawText.trim()) return;
    setStatus("기록 분석 중...");

    const res = await fetch("/api/records/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        raw_text: rawText,
        owner_pubkey: publicKey.toBase58(),
      }),
    });

    const data: DraftResponse = await res.json();
    setDraft(data);
    setStatus("분석 완료! 블록체인에 커밋하세요.");
  }

  async function handleCommit() {
    if (!publicKey || !draft || !sendTransaction) return;
    setStatus("트랜잭션 생성 중...");

    try {
      const { buildRecordTx } = await import("@/lib/solana/tx");
      const tx = await buildRecordTx(draft.record_hash, publicKey);
      const sig = await sendTransaction(tx, connection);
      setStatus(`전송 완료! sig: ${sig}`);

      await fetch("/api/records/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_hash: draft.record_hash,
          owner_pubkey: publicKey.toBase58(),
          tx_sig: sig,
        }),
      });

      setStatus(`커밋 완료! tx: ${sig}`);
    } catch (err) {
      setStatus(`오류: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const ai: AiOutput | null = draft?.ai ?? null;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">AtopyPass</h1>
        <WalletMultiButton />
      </header>

      {!publicKey ? (
        <p className="text-gray-500">지갑을 연결해주세요.</p>
      ) : (
        <div className="space-y-6">
          {/* Input */}
          <div>
            <label className="mb-2 block font-medium">오늘의 피부 상태</label>
            <textarea
              className="w-full rounded border p-3 text-sm"
              rows={5}
              placeholder="오늘 가려움이 심했고, 목 부위에 발진이 있었어요..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <button
              onClick={handleDraft}
              disabled={!rawText.trim()}
              className="mt-2 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
            >
              AI 분석
            </button>
          </div>

          {/* AI result */}
          {ai && (
            <div className="rounded border bg-gray-50 p-4">
              <h2 className="mb-2 font-semibold">AI 분석 결과</h2>
              <p className="mb-2 text-sm">{ai.summary_ko}</p>
              {ai.itch_score !== null && (
                <p className="text-sm">가려움 점수: {ai.itch_score}/10</p>
              )}
              {ai.triggers.length > 0 && (
                <p className="text-sm">트리거: {ai.triggers.join(", ")}</p>
              )}
              {ai.products.length > 0 && (
                <p className="text-sm">제품: {ai.products.join(", ")}</p>
              )}

              <h3 className="mt-3 font-medium">의사 질문 추천</h3>
              <ul className="list-inside list-disc text-sm">
                {ai.doctor_questions_ko.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Commit */}
          {draft && (
            <div>
              <p className="mb-2 text-xs text-gray-500">
                hash: {draft.record_hash}
              </p>
              <button
                onClick={handleCommit}
                className="rounded bg-green-600 px-4 py-2 text-white"
              >
                Solana에 커밋
              </button>
            </div>
          )}

          {/* Status */}
          {status && (
            <p className="rounded bg-yellow-50 p-3 text-sm">{status}</p>
          )}
        </div>
      )}
    </main>
  );
}
