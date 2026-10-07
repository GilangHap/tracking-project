import type { Metadata, Viewport } from "next";
import {
  Fredoka,
  Space_Grotesk,
  Plus_Jakarta_Sans,
  Space_Mono,
} from "next/font/google";
import "./globals.css";

const brand = Fredoka({
  variable: "--font-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = Space_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Project Tracking & QR Clock In-Out",
  description: "Pencatatan waktu pengerjaan project via QR Code",
};

export const viewport: Viewport = {
  themeColor: "#1b1b3a",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${brand.variable} ${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
