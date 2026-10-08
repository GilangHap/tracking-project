import { Window } from "@/components/ui";
import { Loader } from "@/components/loader";

/** Fallback navigasi route admin: jendela loading brutalist. */
export default function AdminLoading() {
  return (
    <Window title="Memuat….Exe" bar="bg-butter">
      <div className="flex justify-center py-8">
        <Loader label="Memuat data…" />
      </div>
    </Window>
  );
}
