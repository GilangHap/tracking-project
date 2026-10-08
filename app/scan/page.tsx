import type { Metadata } from "next";
import Link from "next/link";
import { ScannerClient } from "@/app/scan/scanner-client";

export const metadata: Metadata = {
  title: "Scan QR — Project Tracker",
  description: "Pindai QR Code project untuk Clock In / Clock Out",
};

export default function ScanIndexPage() {
  return (
    <div className="bg-grid flex min-h-dvh items-center justify-center bg-canvas px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <main className="w-full max-w-sm py-8">
        <Link
          href="/"
          className="mark-link mb-3 inline-block rounded font-mono text-sm font-bold tracking-wider uppercase"
        >
          ← Beranda
        </Link>
        <ScannerClient />
        <p className="mt-3 text-center font-mono text-[11px] tracking-widest text-inkfaint">
          BUTUH HTTPS / LOCALHOST UNTUK KAMERA
        </p>
      </main>
    </div>
  );
}
