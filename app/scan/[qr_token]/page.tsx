import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ScanInfo } from "@/lib/types";
import { Window } from "@/components/ui";
import ScanClient from "@/app/scan/[qr_token]/scan-client";

// Halaman scan harus mencerminkan status session terkini → dinamis per request.
export const instant = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-grid flex min-h-dvh items-center justify-center bg-canvas px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <main className="w-full max-w-sm py-8">{children}</main>
    </div>
  );
}

export default async function ScanPage({
  params,
}: {
  params: Promise<{ qr_token: string }>;
}) {
  const { qr_token } = await params;
  if (!UUID_RE.test(qr_token)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_scan_project", {
    p_qr_token: qr_token,
  });

  if (error) {
    const code = error.message ?? "";
    if (code.includes("PROJECT_NOT_FOUND")) {
      return (
        <Shell>
          <Window title="Error_QR.Exe" bar="bg-bubblegum">
            <div className="text-center">
              <h1 className="font-display text-xl font-bold uppercase">
                QR tidak valid
              </h1>
              <p className="mt-2 text-sm text-inksoft">
                QR Code tidak valid atau project tidak ditemukan. Minta QR
                baru ke admin.
              </p>
            </div>
          </Window>
        </Shell>
      );
    }
    return (
      <Shell>
        <Window title="Error_Koneksi.Exe" bar="bg-bubblegum">
          <div className="text-center">
            <h1 className="font-display text-xl font-bold uppercase">
              Gangguan koneksi
            </h1>
            <p className="mt-2 text-sm text-inksoft">
              Tidak dapat memuat project. Tutup lalu scan ulang…
            </p>
          </div>
        </Window>
      </Shell>
    );
  }

  const info = data as ScanInfo;
  if (info.is_archived) {
    return (
      <Shell>
        <Window title="Project_Archived.Exe" bar="bg-peach">
          <div className="text-center">
            <h1 className="font-display text-xl font-bold uppercase">
              {info.name}
            </h1>
            <p role="alert" className="mt-2 text-sm font-bold text-danger">
              ✕ Project ini sudah tidak tersedia untuk pencatatan (Archived).
            </p>
          </div>
        </Window>
      </Shell>
    );
  }

  return (
    <Shell>
      <ScanClient info={info} />
    </Shell>
  );
}
