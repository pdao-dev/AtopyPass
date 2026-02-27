"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import type { AiOutput, DoctorRecordSummary } from "@/types";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, ArrowLeft, ArrowRight, ShieldCheck,
  ShieldAlert, RefreshCw, Layers, FileText, Droplet, Flame
} from "lucide-react";
import Link from "next/link";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton,
    ),
  { ssr: false },
);

const POLL_INTERVAL = 5_000; // 5 seconds

interface RecordDetail {
  record_hash: string;
  owner_pubkey: string;
  created_at: string;
  raw_text: string;
  ai_json: string | null;
  status: string;
}

const fadeSlide = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

const popIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4 } },
};

export default function DoctorPage() {
  const { publicKey } = useWallet();
  const [records, setRecords] = useState<DoctorRecordSummary[]>([]);
  const [selectedHash, setSelectedHash] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [revokedNotice, setRevokedNotice] = useState(false);
  const prevHashesRef = useRef<Set<string>>(new Set());

  const fetchRecords = useCallback(async () => {
    if (!publicKey) return;
    const res = await fetch(
      `/api/doctor/records?doctor=${publicKey.toBase58()}`,
    );
    if (!res.ok) return;
    const data = await res.json();
    const newRecords: DoctorRecordSummary[] = data.records ?? [];
    const newHashes = new Set(newRecords.map((r) => r.record_hash));

    // If the currently viewed record was revoked, clear detail
    if (selectedHash && !newHashes.has(selectedHash)) {
      setSelectedHash(null);
      setDetail(null);
      setRevokedNotice(true);
      setTimeout(() => setRevokedNotice(false), 5000);
    }

    prevHashesRef.current = newHashes;
    setRecords(newRecords);
  }, [publicKey, selectedHash]);

  // Initial fetch + polling
  useEffect(() => {
    fetchRecords().catch(() => { });
    const id = setInterval(() => { fetchRecords().catch(() => { }); }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchRecords]);

  async function viewRecord(hash: string) {
    if (!publicKey) return;
    const res = await fetch(
      `/api/doctor/record/${hash}?doctor=${publicKey.toBase58()}`,
    );
    if (res.ok) {
      const data = await res.json();
      setDetail(data.record as RecordDetail);
      setSelectedHash(hash);
      setRevokedNotice(false);
    } else {
      setDetail(null);
      setSelectedHash(null);
      setRevokedNotice(true);
      setTimeout(() => setRevokedNotice(false), 5000);
    }
  }

  const detailAi: AiOutput | null =
    detail?.ai_json ? JSON.parse(detail.ai_json) : null;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--accent)] selection:text-white pb-24">
      {/* ── Fixed Navigation (Glassmorphic) ── */}
      <nav className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-4 md:px-12 border-b border-black/5 bg-[rgba(250,249,246,0.85)] backdrop-blur-[12px]">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/20">
            <Activity className="text-white" size={20} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight text-blue-950">AtopyPass <span className="text-blue-500 font-medium">Provider</span></span>
        </div>
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="hidden text-sm font-medium text-gray-500 transition hover:text-blue-600 md:block"
          >
            Patient Portal
          </Link>
          <WalletMultiButton className="!h-10 !rounded-full !bg-black !px-6 !text-sm !font-semibold transition hover:!scale-105 active:!scale-95 shadow-md shadow-black/10" />
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-6 pt-32 md:px-8 md:pt-40">

        {/* Revoke Notice */}
        <AnimatePresence>
          {revokedNotice && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="glass-card mb-8 flex items-center gap-3 rounded-2xl border-red-200 bg-red-50/90 px-6 py-4 text-sm font-medium text-red-800 shadow-xl"
            >
              <ShieldAlert size={18} className="text-red-500" />
              Access to this record has been explicitly revoked by the patient. It is no longer available.
            </motion.div>
          )}
        </AnimatePresence>

        {!publicKey ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card mx-auto mt-12 flex max-w-lg flex-col items-center gap-6 rounded-3xl p-12 text-center"
          >
            <div className="rounded-full bg-blue-50 p-4">
              <ShieldCheck size={32} className="text-blue-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Provider Authentication Required</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Please connect your verified Solana wallet to access patient data granted via on-chain consent.
              </p>
            </div>
          </motion.div>
        ) : (
          <div className={`grid gap-8 transition-all duration-500 ${selectedHash ? "lg:grid-cols-12" : "grid-cols-1"}`}>

            {/* Left Column: Shared Records List */}
            <motion.div
              layout
              className={`space-y-6 ${selectedHash ? "lg:col-span-5" : "max-w-3xl mx-auto w-full"}`}
            >
              <div className="mb-8 flex items-end justify-between">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Patient Dashboard</h1>
                  <p className="mt-2 text-sm font-medium text-gray-400 flex items-center gap-2">
                    <RefreshCw size={12} className="animate-spin-slow" />
                    Auto-syncing every 5s via on-chain state
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 font-mono text-xs font-bold text-blue-700">
                  <Layers size={14} />
                  {records.length} Active Records
                </div>
              </div>

              {records.length === 0 ? (
                <div className="rounded-[2rem] border border-dashed border-gray-300 bg-gray-50/50 p-12 text-center">
                  <Activity size={32} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-[15px] font-medium text-gray-500">No active patient logs shared with you.</p>
                  <p className="mt-1 text-sm text-gray-400">Wait for patients to grant access via AtopyPass.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <AnimatePresence>
                    {records.map((r, i) => (
                      <motion.div
                        layout
                        initial="hidden"
                        animate="visible"
                        exit={{ opacity: 0, x: -20 }}
                        variants={fadeSlide}
                        key={r.record_hash}
                        onClick={() => viewRecord(r.record_hash)}
                        className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-5 transition-all duration-300 ${selectedHash === r.record_hash
                          ? "border-blue-500 bg-blue-50 shadow-md shadow-blue-500/10"
                          : "border-black/5 bg-white hover:border-blue-200 hover:shadow-sm"
                          }`}
                      >
                        {selectedHash === r.record_hash && (
                          <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
                        )}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            {r.ai_summary ? (
                              <p className={`font-semibold leading-snug transition-colors ${selectedHash === r.record_hash ? "text-blue-950" : "text-gray-900"}`}>
                                {r.ai_summary}
                              </p>
                            ) : (
                              <p className="font-semibold text-gray-400 italic">Unprocessed Log</p>
                            )}
                            <div className="mt-3 flex items-center gap-3 font-mono text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <ShieldCheck size={12} className={selectedHash === r.record_hash ? "text-blue-500" : "text-gray-300"} />
                                {r.owner_pubkey.slice(0, 6)}...{r.owner_pubkey.slice(-4)}
                              </span>
                              <span>•</span>
                              <span>{new Date(r.created_at).toLocaleString("ko-KR", { month: "short", day: "numeric" })}</span>
                            </div>
                          </div>
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors ${selectedHash === r.record_hash ? "bg-blue-200 text-blue-700" : "bg-gray-50 text-gray-300 group-hover:bg-blue-50 group-hover:text-blue-400"}`}>
                            <ArrowRight size={16} />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </motion.div>

            {/* Right Column: Record Detail view */}
            {selectedHash && detail && (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={popIn}
                className="lg:col-span-7"
              >
                <div className="glass-card sticky top-32 overflow-hidden rounded-[2rem] border border-blue-100 p-1 shadow-2xl shadow-blue-900/5">
                  <div className="rounded-[1.75rem] bg-white p-6 md:p-8 relative">

                    {/* Header Controls */}
                    <div className="mb-8 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                          <FileText size={18} />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-gray-900">Clinical Overview</h2>
                          <p className="text-[11px] font-mono font-medium text-gray-400">Hash: {detail.record_hash.slice(0, 16)}...</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedHash(null);
                          setDetail(null);
                        }}
                        className="flex items-center gap-1.5 rounded-full bg-gray-100 px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-200 transition"
                      >
                        <ArrowLeft size={14} /> Close
                      </button>
                    </div>

                    {/* Meta Info */}
                    <div className="mb-6 flex flex-wrap gap-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4 font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 uppercase tracking-wider font-bold text-[10px]">Patient Identity</span>
                        <span className="font-semibold text-gray-800 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200">{detail.owner_pubkey}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 uppercase tracking-wider font-bold text-[10px]">Timestamp</span>
                        <span className="font-semibold text-gray-800 bg-white px-2 py-0.5 rounded shadow-sm border border-gray-200">
                          {new Date(detail.created_at).toLocaleString("ko-KR")}
                        </span>
                      </div>
                    </div>

                    {/* AI Analysis Section */}
                    {detailAi ? (
                      <div className="mb-8 space-y-6">
                        <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50/50 p-6 border border-blue-100 shadow-inner">
                          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-800">
                            <Activity size={14} /> AI Symptom Extraction
                          </h3>
                          <p className="text-[15px] leading-relaxed text-blue-950 font-medium">
                            {detailAi.summary_ko}
                          </p>

                          <div className="mt-5 flex flex-wrap gap-2">
                            {detailAi.itch_score !== null && (
                              <span className="flex items-center gap-1 font-mono rounded-lg bg-red-100/80 px-3 py-1.5 text-xs font-bold text-red-700 shadow-sm border-b-2 border-red-200">
                                <Flame size={12} className="-mt-0.5" /> PRURITUS: {detailAi.itch_score}/10
                              </span>
                            )}
                            {detailAi.triggers.map((t) => (
                              <span key={t} className="font-mono rounded-lg bg-orange-100/80 px-3 py-1.5 text-xs font-bold text-orange-800 shadow-sm border-b-2 border-orange-200">
                                TRIGGER: {t}
                              </span>
                            ))}
                            {detailAi.products.map((p) => (
                              <span key={p} className="flex items-center gap-1 font-mono rounded-lg bg-purple-100/80 px-3 py-1.5 text-xs font-bold text-purple-800 shadow-sm border-b-2 border-purple-200">
                                <Droplet size={12} className="-mt-0.5" /> PROD: {p}
                              </span>
                            ))}
                          </div>
                        </div>

                        {detailAi.doctor_questions_ko.length > 0 && (
                          <div>
                            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Patient Queries</h4>
                            <ul className="space-y-2">
                              {detailAi.doctor_questions_ko.map((q, i) => (
                                <li key={i} className="flex items-start gap-3 rounded-xl bg-gray-50 p-4 border border-gray-100 text-[14px] text-gray-800 shadow-sm">
                                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-600">
                                    {i + 1}
                                  </div>
                                  <span className="font-medium">{q}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mb-8 text-sm italic text-gray-400">No AI-extracted data available.</p>
                    )}

                    {/* Raw transcription */}
                    <div>
                      <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Raw Patient Log</h4>
                      <p className="rounded-xl bg-[#faf9f6] p-5 text-[15px] leading-relaxed text-gray-700 font-serif border border-black/5 shadow-inner">
                        &quot;{detail.raw_text}&quot;
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
