"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { deleteProject } from "@/app/admin/projects/actions";
import { WinControls } from "@/components/ui";

/**
 * Hapus permanen project: modal verifikasi ketik-ulang nama project.
 * Tidak bisa dibatalkan — seluruh record + audit ikut terhapus.
 */
export function DeleteProjectButton({
  projectId,
  projectName,
  sessionCount,
}: {
  projectId: string;
  projectName: string;
  sessionCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, formAction, pending] = useActionState(deleteProject, {
    error: null,
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // Fokus setelah paint agar keyboard HP langsung muncul.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, pending]);

  const match = typed.trim() === projectName;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
        className="press min-h-11 w-full cursor-pointer rounded border-2 border-ink bg-paper px-5 py-2.5 font-mono text-sm font-bold tracking-wider uppercase text-danger shadow-brutal-sm hover:bg-dangersoft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
      >
        ✕ Hapus Permanen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-ink/50 p-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            className="w-full max-w-sm border-2 border-ink bg-paper shadow-brutal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-dangersoft px-3 py-1.5">
              <p
                id="delete-title"
                className="truncate font-mono text-xs font-bold tracking-widest uppercase"
              >
                Hapus_Permanen.Exe
              </p>
              <WinControls />
            </div>
            <form action={formAction} className="p-4 md:p-5">
              <input type="hidden" name="id" value={projectId} />
              <p className="font-display text-xl font-bold uppercase">
                Hapus “{projectName}”?
              </p>
              <p className="mt-1 text-sm font-bold text-danger">
                ✕ Tidak bisa dibatalkan — {sessionCount} record + QR + riwayat
                koreksi ikut musnah.
              </p>
              <label className="mt-4 block font-mono text-xs font-bold tracking-widest uppercase">
                Ketik ulang nama project untuk verifikasi
                <input
                  ref={inputRef}
                  type="text"
                  name="confirm_name"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={projectName}
                  aria-label="Ketik ulang nama project"
                  className="mt-1 w-full rounded border-2 border-ink bg-paper px-4 py-2.5 font-body text-base font-semibold normal-case placeholder:text-inkfaint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                />
              </label>
              {state.error && (
                <p
                  role="alert"
                  className="mt-3 rounded border-2 border-ink bg-dangersoft/60 px-3 py-2 text-sm font-bold text-danger"
                >
                  ✕ {state.error}
                </p>
              )}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setOpen(false)}
                  className="press min-h-11 cursor-pointer rounded border-2 border-ink bg-paper px-4 py-2 font-mono text-sm font-bold uppercase shadow-brutal-sm hover:bg-lavender disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={pending || !match}
                  className="press min-h-11 cursor-pointer rounded border-2 border-ink bg-danger px-4 py-2 font-mono text-sm font-bold uppercase text-white shadow-brutal-sm disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {pending ? "Menghapus…" : "Ya, hapus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
