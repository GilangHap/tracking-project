"use client";

import { useEffect, useRef, useState } from "react";
import { logout } from "@/app/admin/projects/actions";
import { WinControls } from "@/components/ui";

/** Tombol Keluar dengan dialog konfirmasi gaya jendela retro. */
export function LogoutButton({ full = false }: { full?: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open ]);

  async function confirm() {
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`press cursor-pointer rounded border-2 border-ink px-3 py-1.5 font-mono font-bold uppercase shadow-brutal-sm hover:bg-dangersoft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
          full
            ? "lift min-h-11 w-full bg-butter px-5 py-2.5 text-sm"
            : "min-h-9 bg-paper text-xs"
        }`}
      >
        Keluar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            className="w-full max-w-xs border-2 border-ink bg-paper shadow-brutal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-butter px-3 py-1.5">
              <p
                id="logout-title"
                className="truncate font-mono text-xs font-bold tracking-widest uppercase"
              >
                Konfirmasi_Keluar
              </p>
              <WinControls />
            </div>
            <div className="p-4">
              <p className="font-bold">Yakin mau keluar?</p>
              <p className="mt-1 text-sm text-inksoft">
                Sesi admin berakhir, login lagi untuk mengelola project.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  ref={cancelRef}
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="press min-h-11 cursor-pointer rounded border-2 border-ink bg-paper px-4 py-2 font-mono text-sm font-bold uppercase shadow-brutal-sm hover:bg-lavender disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={confirm}
                  className="press min-h-11 cursor-pointer rounded border-2 border-ink bg-danger px-4 py-2 font-mono text-sm font-bold uppercase text-white shadow-brutal-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {busy ? "…" : "Ya, keluar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
