import { Window } from "@/components/ui";
import { Loader } from "@/components/loader";

/** Fallback halaman scanner saat streaming. */
export default function ScanLoading() {
  return (
    <div className="bg-grid flex min-h-dvh items-center justify-center bg-canvas px-4">
      <main className="w-full max-w-sm py-8">
        <Window title="Memuat….Exe" bar="bg-butter">
          <div className="flex justify-center py-6">
            <Loader label="Menyiapkan scanner…" />
          </div>
        </Window>
      </main>
    </div>
  );
}
