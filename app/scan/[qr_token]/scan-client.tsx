"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtTimeWIB, fmtDuration } from "@/lib/format";
import type { ClockResult, ScanInfo } from "@/lib/types";
import { WinControls } from "@/components/ui";

type Phase = "ready" | "confirm" | "working" | "done" | "failed";

const FOCUS =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/**
 * Terminal Clock In/Out gaya jendela retro: title bar berwarna ikut status,
 * tombol raksasa border tebal + shadow, readout mono.
 */
export default function ScanClient({ info }: { info: ScanInfo }) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [result, setResult] = useState<ClockResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const action = result?.action ?? info.next_action;
  const isIn = action === "IN";
  const bar = isIn ? "bg-butter" : "bg-peach";

  async function submit() {
    setPhase("working");
    setError(null);
    try {
      // Token diambil dari URL /scan/{token} saat submit.
      const seg = window.location.pathname.split("/").filter(Boolean);
      const token = seg[seg.length - 1] ?? "";
      const supabase = createClient();
      const { data, error } = await supabase.rpc("clock_toggle", {
        p_qr_token: token,
      });
      if (error) throw new Error(error.message);
      setResult(data as ClockResult);
      setPhase("done");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "UNKNOWN";
      if (msg.includes("PROJECT_ARCHIVED")) {
        setError("Project sudah di-archive. Pencatatan ditolak.");
      } else if (msg.includes("CONCURRENT_CONFLICT")) {
        setError("Tombol sudah ditekan / scan ganda. Muat ulang halaman…");
      } else if (msg.includes("PROJECT_NOT_FOUND")) {
        setError("QR tidak valid atau project tidak ditemukan.");
      } else {
        setError("Gagal menyimpan. Periksa sinyal lalu coba lagi.");
      }
      setPhase("failed");
    }
  }

  return (
    <div className="border-2 border-ink bg-paper shadow-brutal-lg">
      <div
        className={`flex items-center justify-between gap-2 border-b-2 border-ink px-3 py-1.5 ${bar}`}
      >
        <p className="truncate font-mono text-xs font-bold tracking-widest uppercase">
          {isIn ? "Clock_In.Exe" : "Clock_Out.Exe"}
        </p>
        <WinControls />
      </div>

      <div className="p-5" aria-live="polite">
        <span className="inline-block rounded border-2 border-ink bg-sky/40 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase">
          {info.process}
        </span>
        <h1 className="mt-2 font-display text-2xl font-bold break-words uppercase">
          {info.name}
        </h1>

        {phase !== "done" && (
          <div className="mt-3 flex items-center justify-between gap-3">
            <span
              className={`inline-flex items-center gap-2 rounded border-2 border-ink px-2 py-1 font-mono text-xs font-bold tracking-widest uppercase ${
                isIn ? "bg-mint" : "bg-peach"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-ink motion-safe:animate-pulse"
              />
              {isIn ? "Siap · Clock In" : "Siap · Clock Out"}
            </span>
            {info.next_action === "OUT" && info.active_clock_in && (
              <span className="font-mono text-sm font-bold tabular-nums">
                IN {fmtTimeWIB(info.active_clock_in)}
              </span>
            )}
          </div>
        )}

        {phase === "ready" && (
          <button
            onClick={() => setPhase("confirm")}
            className={`press mt-4 min-h-20 w-full cursor-pointer rounded border-2 border-ink px-5 py-5 font-mono text-2xl font-bold tracking-wider uppercase shadow-brutal ${FOCUS} ${
              isIn ? "bg-butter" : "bg-peach"
            }`}
          >
            {isIn ? "Clock In" : "Clock Out"}
          </button>
        )}

        {phase === "confirm" && (
          <div className="mt-4 rounded border-2 border-ink bg-canvas p-4">
            <p className="font-bold">
              Yakin {isIn ? "Clock In" : "Clock Out"} {info.name}?
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setPhase("ready")}
                className={`press min-h-14 cursor-pointer rounded border-2 border-ink bg-paper px-5 py-3 font-mono text-lg font-bold uppercase shadow-brutal-sm ${FOCUS}`}
              >
                Batal
              </button>
              <button
                onClick={submit}
                className={`press min-h-14 cursor-pointer rounded border-2 border-ink px-5 py-3 font-mono text-lg font-bold uppercase shadow-brutal-sm ${FOCUS} ${
                  isIn ? "bg-butter" : "bg-peach"
                }`}
              >
                OK
              </button>
            </div>
          </div>
        )}

        {phase === "working" && (
          <p className="mt-4 animate-pulse py-5 text-center font-mono text-sm font-bold tracking-widest uppercase">
            Menyimpan…
          </p>
        )}

        {phase === "done" && result && (
          <div className="mt-4 rounded border-2 border-ink bg-mint/50 p-4 text-center">
            <p className="font-mono text-xs font-bold tracking-widest uppercase">
              ✓ Tersimpan
            </p>
            <p className="mt-1 font-display text-lg font-bold">
              {result.action === "IN" ? "Clock In" : "Clock Out"}{" "}
              {result.clock_out
                ? `${fmtTimeWIB(result.clock_in)} → ${fmtTimeWIB(result.clock_out)}`
                : fmtTimeWIB(result.clock_in)}
            </p>
            {typeof result.duration_secs === "number" && (
              <p className="mt-1 font-display text-4xl font-bold text-bubblegumink tabular-nums">
                {fmtDuration(result.duration_secs)}
              </p>
            )}
            {result.action === "IN" && (
              <p className="mt-1 font-mono text-[11px] text-inksoft">
                SCAN LAGI UNTUK CLOCK OUT
              </p>
            )}
          </div>
        )}

        {phase === "failed" && error && (
          <div className="mt-4">
            <p
              role="alert"
              className="rounded border-2 border-ink bg-dangersoft/60 px-4 py-3 text-sm font-bold text-danger"
            >
              ✕ {error}
            </p>
            <button
              onClick={() => setPhase("ready")}
              className={`press mt-3 min-h-14 w-full cursor-pointer rounded border-2 border-ink bg-paper px-5 py-3 font-mono font-bold uppercase shadow-brutal-sm ${FOCUS}`}
            >
              Coba Lagi
            </button>
          </div>
        )}

        <p className="mt-4 text-center font-mono text-[11px] tracking-widest text-inkfaint">
          WAKTU TERCATAT WIB · TANPA LOGIN
        </p>
      </div>
    </div>
  );
}
