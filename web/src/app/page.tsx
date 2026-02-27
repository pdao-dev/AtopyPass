"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import type { AiOutput, DraftResponse, UserRecord } from "@/types";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  Sparkles,
  ShieldCheck,
  Clock,
  Share2,
  ShieldBan,
  ArrowRight,
  Activity,
  Droplet,
  Flame,
  FileText
} from "lucide-react";

const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton,
    ),
  { ssr: false },
);

const EXPLORER_BASE = "https://explorer.solana.com/tx";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";

function explorerUrl(sig: string) {
  return `${EXPLORER_BASE}/${sig}?cluster=${CLUSTER}`;
}

// Fade in up animation variant
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

export default function UserPage() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  // Scroll effect for navbar and hero
  const { scrollY } = useScroll();
  const navBg = useTransform(scrollY, [0, 50], ["rgba(250, 249, 246, 0)", "rgba(250, 249, 246, 0.85)"]);
  const navBlur = useTransform(scrollY, [0, 50], ["blur(0px)", "blur(12px)"]);

  // ── New entry state ──
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState<DraftResponse | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Records state ──
  const [records, setRecords] = useState<UserRecord[]>([]);

  // ── Grant form state ──
  const [grantTarget, setGrantTarget] = useState<string | null>(null);
  const [doctorPubkey, setDoctorPubkey] = useState("");
  const [expiryHours, setExpiryHours] = useState(48);

  const fetchRecords = useCallback(async () => {
    if (!publicKey) return;
    const res = await fetch(`/api/records?owner=${publicKey.toBase58()}`);
    if (res.ok) {
      const data = await res.json();
      setRecords(data.records ?? []);
    }
  }, [publicKey]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // ── Handlers ──
  async function handleDraft() {
    if (!publicKey || !rawText.trim()) return;
    setLoading(true);
    setStatus("기록 분석 중... 🧬");
    try {
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
    } catch (err) {
      setStatus(`오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit() {
    if (!publicKey || !draft || !sendTransaction) return;
    setLoading(true);
    setStatus("트랜잭션 서명 중... ✍️");
    try {
      const { buildRecordTx } = await import("@/lib/solana/tx");
      const tx = await buildRecordTx(draft.record_hash, publicKey);
      const sig = await sendTransaction(tx, connection);
      setStatus("트랜잭션 확인 대기 중... ⏳");

      await connection.confirmTransaction(sig, "confirmed");

      await fetch("/api/records/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          record_hash: draft.record_hash,
          owner_pubkey: publicKey.toBase58(),
          tx_sig: sig,
        }),
      });

      setStatus("");
      setDraft(null);
      setRawText("");
      await fetchRecords();
    } catch (err) {
      setStatus(`오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGrant(recordHash: string) {
    if (!publicKey || !sendTransaction || !doctorPubkey.trim()) return;
    setLoading(true);
    setStatus("공유 권한 서명 중... 🤝");
    try {
      const { buildGrantTx } = await import("@/lib/solana/tx");
      const expiryTs = Math.floor(Date.now() / 1000) + expiryHours * 3600;
      const tx = await buildGrantTx(
        recordHash,
        doctorPubkey.trim(),
        expiryTs,
        publicKey,
      );
      const sig = await sendTransaction(tx, connection);
      setStatus("트랜잭션 확인 대기 중... ⏳");

      await connection.confirmTransaction(sig, "confirmed");

      await fetch("/api/consents/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_pubkey: publicKey.toBase58(),
          tx_sig: sig,
        }),
      });

      setStatus("");
      setGrantTarget(null);
      setDoctorPubkey("");
      await fetchRecords();
    } catch (err) {
      setStatus(`오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke(recordHash: string, doctorPub: string) {
    if (!publicKey || !sendTransaction) return;
    setLoading(true);
    setStatus("권한 철회 서명 중... 🔒");
    try {
      const { buildRevokeTx } = await import("@/lib/solana/tx");
      const tx = await buildRevokeTx(recordHash, doctorPub, publicKey);
      const sig = await sendTransaction(tx, connection);
      setStatus("트랜잭션 확인 대기 중... ⏳");

      await connection.confirmTransaction(sig, "confirmed");

      await fetch("/api/consents/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner_pubkey: publicKey.toBase58(),
          tx_sig: sig,
        }),
      });

      setStatus("");
      await fetchRecords();
    } catch (err) {
      setStatus(`오류: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  }

  const ai: AiOutput | null = draft?.ai ?? null;
  const committedRecords = records.filter((r) => r.status === "committed");
  const nowTs = Math.floor(Date.now() / 1000);

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] selection:bg-[var(--accent)] selection:text-white">
      {/* ── Fixed Navigation (Glassmorphic) ── */}
      <motion.nav
        style={{ backgroundColor: navBg, backdropFilter: navBlur, WebkitBackdropFilter: navBlur }}
        className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-4 md:px-12 border-b border-black/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-[var(--accent)] to-[#da1b60] shadow-lg shadow-orange-500/20">
            <Activity className="text-white" size={20} strokeWidth={2.5} />
          </div>
          <span className="text-xl font-bold tracking-tight">AtopyPass</span>
        </div>
        <div className="flex items-center gap-6">
          <a
            href="/doctor"
            className="hidden text-sm font-medium text-gray-500 transition hover:text-[var(--accent)] md:block"
          >
            For Doctors
          </a>
          <WalletMultiButton className="!h-10 !rounded-full !bg-black !px-6 !text-sm !font-semibold transition hover:!scale-105 active:!scale-95 shadow-md shadow-black/10" />
        </div>
      </motion.nav>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-32 md:px-8 md:pt-40">

        {/* ── Hero Start ── */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} className="mb-16 text-center">
          <h1 className="mb-6 text-5xl font-extrabold tracking-tighter sm:text-6xl md:text-7xl">
            Own your <span className="text-gradient">health data.</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-gray-500 md:text-xl leading-relaxed">
            AI-powered symptom logging with blockchain integrity.
            Share your Atopy journey securely with your doctor, on your own terms.
          </p>
        </motion.div>

        {/* ── Status Toast ── */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-24 z-50 -translate-x-1/2 glass-card flex items-center gap-3 rounded-full px-6 py-3 shadow-2xl"
            >
              <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
              <span className="text-sm font-medium">{status}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {!publicKey ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card mx-auto mt-12 flex max-w-lg flex-col items-center gap-6 rounded-3xl p-12 text-center"
          >
            <div className="rounded-full bg-gray-100 p-4">
              <ShieldCheck size={32} className="text-gray-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold mb-2">Connect to Begin</h2>
              <p className="text-sm text-gray-500">
                Please connect your Solana wallet to securely log and manage your Atopy records.
              </p>
            </div>
          </motion.div>
        ) : (
          <div className="space-y-12">

            {/* ── New Entry Section ── */}
            <motion.section initial="hidden" animate="visible" variants={fadeUp} className="relative">
              <div className="glass-card rounded-[2rem] p-6 md:p-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                    <Sparkles size={16} />
                  </div>
                  <h2 className="text-xl font-bold tracking-tight">Log Today&apos;s Status</h2>
                </div>
                <div className="relative mb-4 group">
                  <textarea
                    className="w-full resize-none rounded-2xl bg-white/50 p-5 text-base placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 transition-all duration-300 min-h-[140px]"
                    placeholder="Describe your symptoms in your own words... (e.g., 가려움이 오늘 심했어요, 새로운 바디워시를 썼습니다)"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-end">
                  <button
                    onClick={handleDraft}
                    disabled={!rawText.trim() || loading}
                    className="group flex items-center gap-2 rounded-full bg-[var(--foreground)] px-8 py-3.5 text-sm font-semibold text-white transition-all hover:scale-[1.02] hover:bg-black disabled:pointer-events-none disabled:opacity-40"
                  >
                    Analyze with AI
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </button>
                </div>
              </div>
            </motion.section>

            {/* ── Draft & AI Analysis Result ── */}
            <AnimatePresence>
              {draft && (
                <motion.section
                  initial={{ opacity: 0, height: 0, y: 20 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-6 overflow-hidden"
                >
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* AI Insights Card */}
                    <div className="rounded-[2rem] bg-gradient-to-br from-white to-gray-50 p-6 md:p-8 shadow-sm border border-black/5">
                      <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                          <Activity size={16} />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">AI Insights</h2>
                      </div>

                      {ai ? (
                        <div className="space-y-6">
                          <p className="text-[15px] leading-relaxed text-gray-700">{ai.summary_ko}</p>

                          <div className="flex flex-wrap gap-2">
                            {ai.itch_score !== null && (
                              <span className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600">
                                <Flame size={12} />
                                가려움 강도 {ai.itch_score}/10
                              </span>
                            )}
                            {ai.triggers.map((t) => (
                              <span key={t} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-medium text-orange-700">
                                {t}
                              </span>
                            ))}
                            {ai.products.map((p) => (
                              <span key={p} className="flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-medium text-purple-700">
                                <Droplet size={12} />
                                {p}
                              </span>
                            ))}
                          </div>

                          {ai.doctor_questions_ko.length > 0 && (
                            <div className="rounded-2xl bg-white p-4 shadow-sm border border-black/5 mt-4">
                              <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-gray-400">Questions for your doctor</h3>
                              <ul className="space-y-2">
                                {ai.doctor_questions_ko.map((q, i) => (
                                  <li key={i} className="flex gap-2 text-sm text-gray-700">
                                    <span className="text-blue-500 font-bold">•</span>
                                    {q}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No AI analysis available for this draft.</p>
                      )}
                    </div>

                    {/* Commit Action Card */}
                    <div className="flex flex-col justify-between rounded-[2rem] bg-gradient-to-br from-green-50 to-emerald-50/50 p-6 md:p-8 border border-green-200/50">
                      <div>
                        <div className="mb-6 flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-200/50 text-green-700">
                            <ShieldCheck size={16} />
                          </div>
                          <h2 className="text-xl font-bold tracking-tight text-green-900">Secure Protocol</h2>
                        </div>
                        <p className="mb-4 text-[15px] leading-relaxed text-green-800">
                          Your medical log is mapped to a cryptographic hash. The actual text stays securely off-chain. Ready to anchor it to Solana?
                        </p>
                        <div className="rounded-xl bg-white/60 px-4 py-3 font-mono text-xs text-green-700/70 break-all mb-4">
                          {draft.record_hash}
                        </div>
                      </div>
                      <button
                        onClick={handleCommit}
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-full bg-green-600 py-3.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:bg-green-700 disabled:pointer-events-none disabled:opacity-50"
                      >
                        Anchor to Blockchain
                      </button>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            {/* ── My Records Section ── */}
            {committedRecords.length > 0 && (
              <motion.section initial="hidden" animate="visible" variants={fadeUp}>
                <div className="mb-8 flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Timeline</h2>
                    <p className="mt-1 text-sm text-gray-500">Your anchored health history.</p>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 font-medium text-sm">
                    {committedRecords.length}
                  </div>
                </div>

                <div className="space-y-6">
                  {committedRecords.map((rec, index) => {
                    const recAi: AiOutput | null = rec.ai_json ? JSON.parse(rec.ai_json) : null;
                    const activeConsents = rec.consents.filter((c) => !c.revoked && c.expiry_ts > nowTs);
                    const isGrantOpen = grantTarget === rec.record_hash;

                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        key={rec.record_hash}
                        className="glass-card overflow-hidden rounded-[2rem] p-1 border border-black/5"
                      >
                        <div className="rounded-[1.75rem] bg-white p-6 md:p-8">
                          {/* Record header */}
                          <div className="mb-4 flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex items-start gap-4">
                              <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-50 text-gray-400 md:flex">
                                <FileText size={20} />
                              </div>
                              <div>
                                <h3 className="text-[17px] font-semibold text-gray-900 leading-snug max-w-[500px]">
                                  {recAi?.summary_ko ?? rec.raw_text.slice(0, 80) + "..."}
                                </h3>
                                <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-400">
                                  <Clock size={14} />
                                  <span>{new Date(rec.created_at).toLocaleString("ko-KR")}</span>
                                  {rec.tx_sig_record && (
                                    <>
                                      <span>•</span>
                                      <a
                                        href={explorerUrl(rec.tx_sig_record)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 font-medium text-blue-500 hover:text-blue-600 hover:underline"
                                      >
                                        Explorer <ArrowRight size={12} className="-rotate-45" />
                                      </a>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Tags */}
                          {recAi && (
                            <div className="mb-6 flex flex-wrap gap-2">
                              {recAi.itch_score !== null && (
                                <span className="rounded-full bg-red-50 px-3 py-1 font-mono text-[11px] font-bold text-red-600 tracking-wide uppercase">
                                  Pain {recAi.itch_score}/10
                                </span>
                              )}
                              {recAi.triggers.map((t) => (
                                <span key={t} className="rounded-full bg-gray-100 px-3 py-1 font-mono text-[11px] font-medium text-gray-600 tracking-wide">
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Consents Box */}
                          <div className="rounded-2xl bg-gray-50/50 border border-gray-100 p-5 mt-2">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-[13px] font-bold uppercase tracking-wider text-gray-400">Shared Access</h4>
                              {!isGrantOpen && (
                                <button
                                  onClick={() => setGrantTarget(rec.record_hash)}
                                  className="group flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] shadow-sm hover:text-[var(--accent)] border border-gray-200 transition-colors"
                                >
                                  <Share2 size={14} className="group-hover:scale-110 transition-transform" />
                                  Share with Doctor
                                </button>
                              )}
                            </div>

                            {activeConsents.length > 0 ? (
                              <div className="space-y-2">
                                {activeConsents.map((c) => (
                                  <div
                                    key={c.doctor_pubkey}
                                    className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm border border-gray-100"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-600">
                                        <ShieldCheck size={14} />
                                      </div>
                                      <div>
                                        <p className="font-mono text-xs font-medium text-gray-700">
                                          {c.doctor_pubkey.slice(0, 8)}...{c.doctor_pubkey.slice(-6)}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-gray-400">
                                          Valid until {new Date(c.expiry_ts * 1000).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => handleRevoke(rec.record_hash, c.doctor_pubkey)}
                                      disabled={loading}
                                      className="flex justify-center items-center gap-1.5 rounded-lg bg-red-50 px-4 py-2 text-xs font-bold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                                    >
                                      <ShieldBan size={14} />
                                      Revoke
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              !isGrantOpen && (
                                <p className="text-sm text-gray-400 py-2">No active sharing permissions.</p>
                              )
                            )}

                            {/* Grant specific UI */}
                            <AnimatePresence>
                              {isGrantOpen && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  className="mt-4 overflow-hidden"
                                >
                                  <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                                      Doctor&apos;s Public Key
                                    </label>
                                    <input
                                      type="text"
                                      className="mb-4 w-full rounded-lg bg-gray-50 px-4 py-3 font-mono text-sm placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 transition-all"
                                      placeholder="Paste Solana address..."
                                      value={doctorPubkey}
                                      onChange={(e) => setDoctorPubkey(e.target.value)}
                                    />

                                    <div className="mb-4">
                                      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                                        Expiration Time
                                      </label>
                                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                        {[1, 24, 48, 168].map(h => (
                                          <button
                                            key={h}
                                            onClick={() => setExpiryHours(h)}
                                            className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${expiryHours === h
                                              ? "border-[var(--accent)] bg-[var(--accent)]/5 text-[var(--accent)]"
                                              : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"
                                              }`}
                                          >
                                            {h === 1 ? "1 hour" : h === 24 ? "24 hours" : h === 48 ? "48 hours" : "7 days"}
                                          </button>
                                        ))}
                                      </div>
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                      <button
                                        onClick={() => {
                                          setGrantTarget(null);
                                          setDoctorPubkey("");
                                        }}
                                        className="rounded-full px-5 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 transition"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleGrant(rec.record_hash)}
                                        disabled={!doctorPubkey.trim() || loading}
                                        className="rounded-full bg-[var(--foreground)] px-6 py-2.5 text-xs font-semibold text-white shadow-md transition-transform hover:scale-105 disabled:opacity-50"
                                      >
                                        Grant Access
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
