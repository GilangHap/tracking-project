"use client";

import { useActionState } from "react";
import { toWIBInputValue } from "@/lib/format";
import type { WorkSession } from "@/lib/types";
import { correctSession } from "@/app/admin/projects/actions";

/** Form koreksi per record: error tampil inline, tidak crash merah. */
export function CorrectionForm({
  s,
  projectId,
}: {
  s: WorkSession;
  projectId: string;
}) {
  const [state, formAction, pending] = useActionState(correctSession, {
    error: null,
  });

  return (
    <form
      action={formAction}
      className="mt-2 min-w-60 space-y-2 rounded border-2 border-ink bg-canvas p-3"
    >
      <input type="hidden" name="session_id" value={s.id} />
      <input type="hidden" name="project_id" value={projectId} />
      <label className="block font-mono text-[11px] font-bold uppercase">
        Clock In (WIB)
        <input
          type="datetime-local"
          name="clock_in"
          required
          step={1}
          defaultValue={toWIBInputValue(s.clock_in)}
          className="mt-1 w-full rounded border-2 border-ink bg-paper px-2 py-1.5"
        />
      </label>
      <label className="block font-mono text-[11px] font-bold uppercase">
        Clock Out (WIB, kosong = aktif)
        <input
          type="datetime-local"
          name="clock_out"
          step={1}
          defaultValue={s.clock_out ? toWIBInputValue(s.clock_out) : ""}
          className="mt-1 w-full rounded border-2 border-ink bg-paper px-2 py-1.5"
        />
      </label>
      <input
        type="text"
        name="reason"
        autoComplete="off"
        placeholder="Alasan, mis. lupa clock out…"
        aria-label="Alasan koreksi"
        className="w-full rounded border-2 border-ink bg-paper px-2 py-1.5 text-xs placeholder:text-inkfaint"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          name="clock_in_by"
          autoComplete="off"
          maxLength={100}
          defaultValue={s.clock_in_by ?? ""}
          placeholder="Yg Clock In…"
          aria-label="Nama yang Clock In"
          className="w-full rounded border-2 border-ink bg-paper px-2 py-1.5 text-xs placeholder:text-inkfaint"
        />
        <input
          type="text"
          name="clock_out_by"
          autoComplete="off"
          maxLength={100}
          defaultValue={s.clock_out_by ?? ""}
          placeholder="Yg Clock Out…"
          aria-label="Nama yang Clock Out"
          className="w-full rounded border-2 border-ink bg-paper px-2 py-1.5 text-xs placeholder:text-inkfaint"
        />
      </div>
      {state.error && (
        <p
          role="alert"
          className="rounded border-2 border-ink bg-dangersoft/60 px-2 py-1.5 text-xs font-bold text-danger"
        >
          ✕ {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="press lift min-h-9 w-full cursor-pointer rounded border-2 border-ink bg-ink px-3 py-1.5 font-mono text-xs font-bold uppercase text-white shadow-brutal-sm disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {pending ? "Menyimpan…" : "Simpan koreksi"}
      </button>
    </form>
  );
}
