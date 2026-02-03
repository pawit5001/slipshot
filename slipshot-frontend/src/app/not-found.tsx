"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function NotFoundPage() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    // Small delay so user sees the message briefly
    const t = setTimeout(() => {
      if (typeof window === "undefined") return;

      // If user has history, go back to previous page
      if (window.history.length > 1) {
        router.back();
        return;
      }

      // Otherwise, send logged-in users to dashboard, others to home
      if (user) router.replace("/dashboard");
      else router.replace("/");
    }, 700);

    return () => clearTimeout(t);
  }, [router, user]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-2">This page could not be found.</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">หน้าไม่พบ — กำลังพากลับไปยังหน้าก่อนหน้าหรือหน้าหลัก</p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded bg-zinc-100 dark:bg-zinc-800"
          >
            กลับ
          </button>
          <Link
            href={user ? "/dashboard" : "/"}
            className="px-4 py-2 rounded bg-blue-600 text-white"
          >
            ไปยังหน้าหลัก
          </Link>
        </div>
      </div>
    </div>
  );
}
