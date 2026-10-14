import Link from "next/link";
import { connection } from "next/server";
import { createProject } from "@/app/admin/projects/actions";
import { Field, Window, inputCls } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

// Dinamis per request agar client_key idempotency selalu baru.
export const instant = false;

export default async function CreateProjectPage() {
  await connection();
  return (
    <div className="max-w-lg">
      <h1 className="font-display text-3xl font-bold uppercase">
        Project Baru
      </h1>
      <p className="font-mono text-xs tracking-widest text-inksoft uppercase">
        QR dibuat otomatis setelah simpan
      </p>
      <Window title="Form_Project.Exe" bar="bg-mint" className="mt-4">
        <form action={createProject} aria-label="Form project baru">
          {/* Kunci idempotency: klik ganda mengirim key sama → 1 project. */}
          <input type="hidden" name="client_key" value={crypto.randomUUID()} />
          <Field
            label="Nama Project"
            hint="Contoh: Bracket Arm Q3 — maks 200 karakter."
          >
            <input
              type="text"
              name="name"
              required
              maxLength={200}
              autoComplete="off"
              placeholder="Project A…"
              className={inputCls}
            />
          </Field>
          <div className="mt-4">
            <Field label="Process">
              <select name="process" required className={inputCls}>
                <option value="Machining">Machining</option>
                <option value="Assembly">Assembly</option>
                <option value="Trial">Trial</option>
              </select>
            </Field>
          </div>
          <div className="mt-6 flex gap-2">
            <SubmitButton
              pendingChildren="Menyimpan…"
              className="press lift min-h-11 flex-1 rounded border-2 border-ink bg-butter px-5 py-3 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Simpan & Buat QR
            </SubmitButton>
            <Link
              href="/admin/projects"
              className="press min-h-11 rounded border-2 border-ink bg-paper px-5 py-3 text-center hover:bg-lavender font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Batal
            </Link>
          </div>
        </form>
      </Window>
    </div>
  );
}
