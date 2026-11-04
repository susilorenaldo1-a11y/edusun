import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import JalaChat from "@/components/JalaChat";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DESCRIPTION =
  "Ajukan dokumen dan dapatkan tanda tangan digital Kepala Dusun secara online — cepat, transparan, dan didukung verifikasi AI.";

export const metadata: Metadata = {
  metadataBase: new URL("https://e-dusun.vercel.app"),
  applicationName: "E-Dusun",
  title: "E-Dusun — Layanan Administrasi Dusun Permata Anyar",
  description: DESCRIPTION,
  keywords: [
    "administrasi desa",
    "tanda tangan digital",
    "surat keterangan",
    "Dusun Permata Anyar",
    "Bali",
    "AI",
  ],
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "E-Dusun",
    url: "/",
    title: "E-Dusun — Administrasi Dusun Berbasis AI",
    description: DESCRIPTION,
    images: [
      {
        url: "/brand/og-image.png",
        width: 1200,
        height: 630,
        alt: "E-Dusun — Administrasi Dusun Berbasis AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "E-Dusun — Administrasi Dusun Berbasis AI",
    description: DESCRIPTION,
    images: ["/brand/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#176346",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <Footer />
        <JalaChat />
      </body>
    </html>
  );
}
