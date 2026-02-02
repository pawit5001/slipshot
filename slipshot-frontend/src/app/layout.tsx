
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppShell from "../components/AppShell";
import { AuthProvider } from "@/context/AuthContext";
import { ModalProvider } from "@/context/ModalContext";
import { DataCacheProvider } from "@/context/DataCacheContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SlipShot - ระบบจัดการสลิปอัจฉริยะ",
  description: "ระบบจัดการสลิปและติดตามค่าใช้จ่ายด้วย OCR อัจฉริยะ รองรับทั้งภาษาไทยและอังกฤษ",
  keywords: ["expense tracker", "slip management", "OCR", "Thai OCR", "budget tracker"],
  authors: [{ name: "SlipShot Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <DataCacheProvider>
            <ModalProvider>
              <AppShell>{children}</AppShell>
            </ModalProvider>
          </DataCacheProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
