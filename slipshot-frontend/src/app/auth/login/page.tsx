"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_ENDPOINTS } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";
import { api } from "@/lib/api";
import Footer from "@/components/Footer";

// แปลง error message เป็นภาษาไทย
const translateError = (error: string): string => {
  const errorMap: Record<string, string> = {
    "No active account found with the given credentials": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    "Invalid credentials": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    "Unable to log in with provided credentials.": "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
    "User not found": "ไม่พบผู้ใช้งาน",
    "Incorrect password": "รหัสผ่านไม่ถูกต้อง",
    "Account is disabled": "บัญชีถูกระงับการใช้งาน",
    "Network Error": "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
    "บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ": "บัญชีของคุณถูกระงับ กรุณาติดต่อผู้ดูแลระบบ",
  };
  
  return errorMap[error] || error;
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refreshUser } = useAuth();
  const { showAlert } = useModal();
  
  // Reset auth state when landing on login page
  useEffect(() => {
    api.resetAuth();
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(API_ENDPOINTS.LOGIN, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMessage = data?.detail || data?.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง";
        showAlert("error", "เข้าสู่ระบบไม่สำเร็จ", translateError(errorMessage));
        setLoading(false);
        return;
      }
      
      // Reset auth state after successful login
      api.resetAuth();
      
      // Refresh auth context (force=true to bypass public path check)
      await refreshUser(true);
      router.push("/dashboard");
    } catch {
      showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
                SlipShot
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">จัดการการเงินอย่างชาญฉลาด</p>
            </Link>
          </div>

          {/* Login Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">เข้าสู่ระบบ</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">ยินดีต้อนรับกลับมา</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Username Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  ชื่อผู้ใช้
                </label>
                <input
                  className="w-full px-4 py-3 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="กรอกชื่อผู้ใช้"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="กรอกรหัสผ่าน"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    กำลังเข้าสู่ระบบ...
                  </span>
                ) : (
                  "เข้าสู่ระบบ"
                )}
              </button>
            </form>

            {/* Register Link */}
            <p className="text-center text-zinc-600 dark:text-zinc-400 text-sm mt-6">
              ยังไม่มีบัญชี?{" "}
              <Link href="/auth/register" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                สมัครสมาชิก
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
