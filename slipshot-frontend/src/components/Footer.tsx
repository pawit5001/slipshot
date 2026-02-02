"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-lg sm:text-xl font-bold bg-linear-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              SlipShot
            </div>
            <span className="hidden sm:inline text-zinc-400 dark:text-zinc-500 text-sm">|</span>
            <span className="hidden sm:inline text-zinc-500 dark:text-zinc-400 text-sm">
              ระบบจัดการสลิปอัจฉริยะ
            </span>
          </div>

          {/* Links - hidden on very small screens */}
          <div className="hidden xs:flex items-center gap-4 sm:gap-6 text-xs sm:text-sm">
            <Link 
              href="/" 
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
            >
              หน้าแรก
            </Link>
            <Link 
              href="/dashboard" 
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
            >
              แดชบอร์ด
            </Link>
            <Link 
              href="/slip" 
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition"
            >
              สลิป
            </Link>
          </div>

          {/* Copyright */}
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            &copy; {currentYear} SlipShot
          </p>
        </div>
      </div>
    </footer>
  );
}
