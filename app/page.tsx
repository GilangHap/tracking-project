import Link from "next/link";
import { SectionBar, Window, WinControls } from "@/components/ui";

const TICKER =
  "SCAN QR · CLOCK IN · CLOCK OUT · DURASI OTOMATIS · MACHINING · ASSEMBLY · TRIAL · TANPA LOGIN · ".repeat(
    2,
  );

const STEPS = [
  {
    file: "01_BUAT_PROJECT.EXE",
    bar: "bg-mint",
    title: "Admin buat project",
    desc: "Cukup nama dan process — QR Code dibuat otomatis.",
  },
  {
    file: "02_TEMPEL_QR.EXE",
    bar: "bg-lavender",
    title: "Tempel QR di area kerja",
    desc: "Download lalu cetak QR unik setiap project.",
  },
  {
    file: "03_SCAN.EXE",
    bar: "bg-peach",
    title: "Operator scan IN/OUT",
    desc: "Tanpa login. Sistem menentukan IN/OUT dari session aktif.",
  },
] as const;

export default function Home() {
  return (
    <div className="bg-grid flex min-h-screen flex-col bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:border-2 focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:font-mono focus:text-sm focus:font-bold"
      >
        Lewati ke konten
      </a>

      {/* Ticker berjalan */}
      <div
        aria-hidden="true"
        className="overflow-hidden border-b-2 border-ink bg-mint py-1"
      >
        <p className="animate-ticker flex w-max font-mono text-xs font-bold tracking-widest whitespace-nowrap uppercase">
          {TICKER}
        </p>
      </div>

      <header className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
          <p className="font-brand text-xl font-semibold tracking-tight">
            Project<span className="text-bubblegumink">_</span>Tracker
          </p>
          <Link
            href="/login"
            className="press rounded border-2 border-ink bg-butter px-4 py-2 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            → Masuk
          </Link>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {/* Hero = jendela sorotan */}
        <section className="border-2 border-ink bg-paper shadow-brutal-lg">
          <div className="flex items-center justify-between gap-2 border-b-2 border-ink bg-sky px-3 py-1.5">
            <p className="truncate font-mono text-xs font-bold tracking-widest uppercase">
              Sorotan_Project.Exe
            </p>
            <WinControls />
          </div>
          <div className="grid gap-6 p-5 md:grid-cols-2 md:p-8">
            <div>
              <span className="inline-block rounded border-2 border-ink bg-mint px-2 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase">
                Machining · Assembly · Trial
              </span>
              <h1 className="mt-3 font-display text-4xl font-bold text-pretty uppercase md:text-5xl">
                Catat jam kerja dengan satu scan.
              </h1>
              <p className="mt-3 max-w-md text-base text-inksoft">
                Setiap project punya QR Code unik. Operator scan dari HP untuk
                Clock In dan Clock Out — durasi dihitung otomatis.
              </p>
              <p className="mt-4 font-display text-3xl font-bold text-bubblegumink">
                Rp 0<span className="text-lg">, gratis selamanya*</span>
              </p>
              <p className="font-mono text-[11px] text-inkfaint">
                *JALANKAN DI SERVER SENDIRI
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/login"
                  className="press rounded border-2 border-ink bg-butter px-6 py-3 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Buka Dashboard
                </Link>
                <a
                  href="#cara-kerja"
                  className="press rounded border-2 border-ink bg-paper px-6 py-3 font-mono text-sm font-bold tracking-wider uppercase shadow-brutal-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  Cara Kerja
                </a>
              </div>
            </div>
            <div className="grid place-items-center rounded border-2 border-dashed border-ink/40 bg-canvas p-6">
              <div className="text-center">
                <p className="font-mono text-xs font-bold tracking-widest text-inksoft uppercase">
                  Contoh QR Project
                </p>
                <div
                  aria-hidden="true"
                  className="mx-auto mt-3 grid h-44 w-44 grid-cols-7 grid-rows-7 gap-1 border-2 border-ink bg-paper p-3 shadow-brutal"
                >
                  {Array.from({ length: 49 }).map((_, i) => (
                    <span
                      key={i}
                      className={
                        (i * 7 + 3) % 5 < 2 ? "bg-ink" : "bg-transparent"
                      }
                    />
                  ))}
                </div>
                <p className="mt-3 font-mono text-[11px] text-inkfaint">
                  /SCAN/{`{QR-TOKEN}`}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Langkah = kartu produk */}
        <div id="cara-kerja" className="mt-10 scroll-mt-20">
          <SectionBar
            title="Cara_Kerja.Exe"
            bar="bg-butter"
            action={
              <Link
                href="/login"
                className="press rounded border-2 border-ink bg-paper px-3 py-1 font-mono text-xs font-bold tracking-wider uppercase shadow-brutal-sm"
              >
                Mulai →
              </Link>
            }
          />
          <ol className="mt-4 grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li
                key={s.file}
                className="border-2 border-ink bg-paper shadow-brutal"
              >
                <div
                  className={`border-b-2 border-ink px-3 py-1.5 ${s.bar}`}
                >
                  <p className="truncate font-mono text-xs font-bold tracking-widest uppercase">
                    {s.file}
                  </p>
                </div>
                <div className="p-4">
                  <span className="inline-block rounded border-2 border-ink bg-butter px-2 py-0.5 font-mono text-[11px] font-bold">
                    #{i + 1}
                  </span>
                  <h3 className="mt-2 font-display text-xl font-bold">
                    {s.title}
                  </h3>
                  <p className="mt-1 text-sm text-inksoft">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>

      <footer className="border-t-2 border-ink bg-paper">
        <p className="mx-auto max-w-5xl px-4 py-3 font-mono text-xs text-inksoft">
          SCAN → KONFIRMASI → TERSIMPAN · WAKTU WIB
        </p>
      </footer>
    </div>
  );
}
