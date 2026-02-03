"use client";
import Link from "next/link";
import Footer from "@/components/Footer";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {

  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();

  // Always force session check on home page
  useEffect(() => {
    refreshUser(true);
  }, [refreshUser]);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-linear-to-br from-blue-50 via-violet-50 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 pt-16">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center mask-[linear-gradient(180deg,white,rgba(255,255,255,0))]"></div>
        
        {/* Animated background elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-violet-400/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
        
        <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-20 md:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs sm:text-sm font-medium mb-6 animate-fade-in">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>อ่านสลิปอัตโนมัติด้วย AI</span>
            </div>
            
            {/* Main heading */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-white mb-4 sm:mb-6">
              จัดการสลิปของคุณ
              <span className="block mt-2 bg-linear-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
                อย่างชาญฉลาด
              </span>
            </h1>
            
            <p className="text-base sm:text-lg md:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto mb-8 px-4">
              SlipShot ช่วยให้คุณบันทึกและวิเคราะห์ค่าใช้จ่ายได้ง่ายดาย 
              เพียงถ่ายรูปสลิป ระบบจะอ่านข้อมูลให้อัตโนมัติ
            </p>
            
            {/* CTA Button - Single prominent button */}
            <div className="flex flex-col items-center gap-4">
              <Link
                href="/auth/register"
                className="group relative px-8 py-4 bg-linear-to-r from-blue-600 to-violet-600 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all hover:shadow-xl hover:shadow-blue-500/40 hover:scale-105 overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  เริ่มต้นใช้งานฟรี
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-linear-to-r from-violet-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </Link>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                มีบัญชีแล้ว?{" "}
                <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 font-medium">
                  เข้าสู่ระบบ
                </Link>
              </p>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:block animate-bounce">
          <svg className="w-6 h-6 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-20 bg-white dark:bg-zinc-900 flex-1">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-4">
              ทำไมต้อง SlipShot?
            </h2>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-xl mx-auto text-sm sm:text-base">
              เครื่องมือที่ออกแบบมาเพื่อการจัดการการเงินส่วนตัวโดยเฉพาะ
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1 */}
            <div className="group p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                อ่านสลิปอัตโนมัติ
              </h3>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                ถ่ายรูปสลิป ระบบ OCR จะอ่านข้อมูลชื่อ จำนวนเงิน และวันที่ให้อัตโนมัติ ทั้งภาษาไทยและอังกฤษ
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:border-green-300 dark:hover:border-green-700 transition-all hover:shadow-lg">
              <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                แดชบอร์ดวิเคราะห์
              </h3>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                ดูรายรับ-รายจ่ายแบบ real-time แยกตามวัน สัปดาห์ เดือน หรือปี พร้อมกราฟสรุป
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 hover:border-violet-300 dark:hover:border-violet-700 transition-all hover:shadow-lg sm:col-span-2 lg:col-span-1">
              <div className="w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
              </div>
              <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-white mb-2">
                จัดหมวดหมู่ง่าย
              </h3>
              <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400">
                สร้าง Tag เพื่อจัดหมวดหมู่รายการต่างๆ เช่น อาหาร เดินทาง ช้อปปิ้ง
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 bg-linear-to-r from-blue-600 to-violet-600">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center text-white">
            <div className="p-4">
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">100%</div>
              <div className="text-blue-100 text-sm sm:text-base">ฟรี ไม่มีค่าใช้จ่าย</div>
            </div>
            <div className="p-4">
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">AI</div>
              <div className="text-blue-100 text-sm sm:text-base">อ่านสลิปอัตโนมัติ</div>
            </div>
            <div className="p-4">
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">24/7</div>
              <div className="text-blue-100 text-sm sm:text-base">ใช้งานได้ตลอด</div>
            </div>
            <div className="p-4">
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2">🔒</div>
              <div className="text-blue-100 text-sm sm:text-base">ปลอดภัย 100%</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
