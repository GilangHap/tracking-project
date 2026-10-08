"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Window } from "@/components/ui";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type CamState =
  | "idle"
  | "starting"
  | "scanning"
  | "denied"
  | "none"
  | "insecure"
  | "busy"
  | "error";

interface CamDevice {
  id: string;
  label: string;
}

/** Ambil token dari hasil scan (URL penuh atau token mentah). */
function extractToken(raw: string): string | null {
  const text = raw.trim();
  const m = text.match(/\/scan\/([0-9a-f-]{36})/i);
  const candidate = m ? m[1] : text;
  return UUID_RE.test(candidate) ? candidate : null;
}

/** Pilih kamera belakang bila ketahuan, kalau tidak kamera pertama. */
function pickPreferred(cams: CamDevice[]): CamDevice {
  const back = cams.find((c) =>
    /back|rear|environment|belakang/i.test(c.label),
  );
  return back ?? cams[0];
}

function messageFor(e: unknown): CamState {
  const name = e instanceof Error ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "none";
  if (name === "NotReadableError" || name === "TrackStartError") return "busy";
  return "error";
}

/** Halaman scanner publik: kamera HP/laptop atau tempel token manual. */
export function ScannerClient() {
  const router = useRouter();
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void;
  } | null>(null);
  const startingRef = useRef(false);
  const [cam, setCam] = useState<CamState>("idle");
  const [cams, setCams] = useState<CamDevice[]>([]);
  const [camId, setCamId] = useState<string>("");
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | null>(null);

  const stop = useCallback(async () => {
    try {
      await scannerRef.current?.stop();
      scannerRef.current?.clear();
    } catch {
      // abaikan — kamera mungkin belum jalan
    } finally {
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  async function startWith(deviceId: string) {
    if (startingRef.current) return;
    startingRef.current = true;
    setCam("starting");
    try {
      // Dynamic import agar SSR/prerender tidak menyentuh API browser.
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-viewport");
      scannerRef.current = scanner;
      await scanner.start(
        { deviceId: { exact: deviceId } },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded) => {
          const token = extractToken(decoded);
          if (!token) return;
          await stop();
          setCam("idle");
          router.push(`/scan/${token}`);
        },
        () => {
          // frame tanpa QR — abaikan diam-diam
        },
      );
      setCamId(deviceId);
      setCam("scanning");
    } catch (e) {
      await stop();
      setCam(messageFor(e));
    } finally {
      startingRef.current = false;
    }
  }

  async function start() {
    // Kamera browser wajib konteks aman (HTTPS / localhost).
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setCam("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCam("none");
      return;
    }
    setCam("starting");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const found = await Html5Qrcode.getCameras();
      if (!found || found.length === 0) {
        setCam("none");
        return;
      }
      const list = found.map((c, i) => ({
        id: c.id,
        label: c.label || `Kamera ${i + 1}`,
      }));
      setCams(list);
      // Coba satu per satu sampai ada yang jalan (belakang dulu).
      const ordered = [pickPreferred(list), ...list.filter((c) => c !== pickPreferred(list))];
      for (const c of ordered) {
        await startWith(c.id);
        if (scannerRef.current) return;
      }
      setCam("error");
    } catch (e) {
      setCam(messageFor(e));
    }
  }

  async function switchCamera(id: string) {
    await stop();
    setCam("idle");
    await startWith(id);
  }

  function openManual(e: React.FormEvent) {
    e.preventDefault();
    const token = extractToken(manual);
    if (!token) {
      setManualError("Token/URL tidak valid. Tempel URL hasil QR project.");
      return;
    }
    setManualError(null);
    router.push(`/scan/${token}`);
  }

  return (
    <Window title="Scan_QR.Exe" bar="bg-butter">
      {cam === "scanning" ? (
        <div>
          <div className="relative overflow-hidden rounded border-2 border-ink">
            <div id="qr-viewport" className="w-full [&_video]:w-full" />
            {/* Bingkai bidik */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
            >
              <span className="absolute top-4 left-4 h-8 w-8 border-t-4 border-l-4 border-butter" />
              <span className="absolute top-4 right-4 h-8 w-8 border-t-4 border-r-4 border-butter" />
              <span className="absolute bottom-4 left-4 h-8 w-8 border-b-4 border-l-4 border-butter" />
              <span className="absolute right-4 bottom-4 h-8 w-8 border-r-4 border-b-4 border-butter" />
            </div>
          </div>
          <p className="mt-3 text-center font-mono text-xs tracking-widest text-inksoft uppercase">
            Arahkan kamera ke QR project…
          </p>
          {cams.length > 1 && (
            <label className="mt-3 block font-mono text-xs font-bold tracking-widest uppercase">
              Kamera
              <select
                value={camId}
                onChange={(e) => switchCamera(e.target.value)}
                className="mt-1 w-full rounded border-2 border-ink bg-paper px-3 py-2 text-sm"
              >
                {cams.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button
            type="button"
            onClick={async () => {
              await stop();
              setCam("idle");
            }}
            className="press mt-3 min-h-11 w-full cursor-pointer rounded border-2 border-ink bg-paper px-4 py-2 font-mono text-sm font-bold uppercase shadow-brutal-sm hover:bg-lavender focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            Matikan Kamera
          </button>
        </div>
      ) : (
        <div className="text-center">
          <p className="font-mono text-xs tracking-widest text-inksoft uppercase">
            Pindai QR project pakai kamera
          </p>
          <button
            type="button"
            onClick={start}
            disabled={cam === "starting"}
            className="press lift mt-3 min-h-14 w-full cursor-pointer rounded border-2 border-ink bg-butter px-5 py-3 font-mono text-lg font-bold uppercase shadow-brutal-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {cam === "starting" ? "Menyalakan…" : "◎ Nyalakan Kamera"}
          </button>
          {cam === "denied" && (
            <p
              role="alert"
              className="mt-3 rounded border-2 border-ink bg-dangersoft/60 px-3 py-2 text-sm font-bold text-danger"
            >
              ✕ Akses kamera ditolak. Izinkan kamera di pengaturan browser /
              HP, lalu coba lagi.
            </p>
          )}
          {cam === "none" && (
            <p
              role="alert"
              className="mt-3 rounded border-2 border-ink bg-peach/50 px-3 py-2 text-sm font-bold"
            >
              Perangkat ini tidak punya kamera yang cocok. Tempel token
              manual di bawah.
            </p>
          )}
          {cam === "insecure" && (
            <p
              role="alert"
              className="mt-3 rounded border-2 border-ink bg-peach/50 px-3 py-2 text-sm font-bold"
            >
              Kamera butuh koneksi aman. Buka situs ini via HTTPS (atau
              localhost), bukan http biasa.
            </p>
          )}
          {cam === "busy" && (
            <p
              role="alert"
              className="mt-3 rounded border-2 border-ink bg-peach/50 px-3 py-2 text-sm font-bold"
            >
              Kamera sedang dipakai aplikasi lain (Zoom/Meet/dll). Tutup
              aplikasi itu lalu coba lagi.
            </p>
          )}
          {cam === "error" && (
            <p
              role="alert"
              className="mt-3 rounded border-2 border-ink bg-dangersoft/60 px-3 py-2 text-sm font-bold text-danger"
            >
              ✕ Kamera gagal dinyalakan. Coba lagi atau tempel token manual.
            </p>
          )}

          <div className="my-4 flex items-center gap-2" aria-hidden="true">
            <span className="h-0.5 flex-1 bg-ink/15" />
            <span className="font-mono text-[11px] font-bold tracking-widest text-inkfaint">
              ATAU
            </span>
            <span className="h-0.5 flex-1 bg-ink/15" />
          </div>

          <form onSubmit={openManual} className="text-left">
            <label className="block font-mono text-xs font-bold tracking-widest uppercase">
              Tempel URL / token QR
              <input
                type="text"
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="https://…/scan/… atau token…"
                className="mt-1 w-full rounded border-2 border-ink bg-paper px-4 py-2.5 font-mono text-sm placeholder:text-inkfaint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              />
            </label>
            {manualError && (
              <p role="alert" className="mt-2 text-sm font-bold text-danger">
                ✕ {manualError}
              </p>
            )}
            <button
              type="submit"
              className="press mt-3 min-h-11 w-full cursor-pointer rounded border-2 border-ink bg-ink px-4 py-2 font-mono text-sm font-bold uppercase text-white shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Buka →
            </button>
          </form>
        </div>
      )}
    </Window>
  );
}
