"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import type { DoctorRecordSummary } from "@/types";

export default function DoctorPage() {
  const { publicKey } = useWallet();
  const [records, setRecords] = useState<DoctorRecordSummary[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!publicKey) return;
    fetch(`/api/doctor/records?doctor=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then((data) => setRecords(data.records ?? []));
  }, [publicKey]);

  async function viewRecord(hash: string) {
    if (!publicKey) return;
    const res = await fetch(
      `/api/doctor/record/${hash}?doctor=${publicKey.toBase58()}`,
    );
    if (res.ok) {
      const data = await res.json();
      setDetail(data.record);
      setSelectedHash(hash);
    } else {
      setDetail(null);
      setSelectedHash(null);
      alert("접근이 거부되었습니다.");
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">AtopyPass — Doctor</h1>
        <WalletMultiButton />
      </header>

      {!publicKey ? (
        <p className="text-gray-500">지갑을 연결해주세요.</p>
      ) : records.length === 0 ? (
        <p className="text-gray-500">열람 가능한 기록이 없습니다.</p>
      ) : (
        <div className="space-y-4">
          <h2 className="font-semibold">열람 가능 기록</h2>
          {records.map((r) => (
            <div
              key={r.record_hash}
              className="cursor-pointer rounded border p-3 hover:bg-gray-50"
              onClick={() => viewRecord(r.record_hash)}
            >
              <p className="text-sm font-medium">{r.owner_pubkey}</p>
              <p className="text-xs text-gray-500">{r.created_at}</p>
              {r.ai_summary && (
                <p className="mt-1 text-sm text-gray-700">{r.ai_summary}</p>
              )}
            </div>
          ))}

          {/* Detail view */}
          {selectedHash && detail && (
            <div className="mt-6 rounded border bg-gray-50 p-4">
              <h3 className="mb-2 font-semibold">기록 상세</h3>
              <pre className="overflow-auto text-xs">
                {JSON.stringify(detail, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
