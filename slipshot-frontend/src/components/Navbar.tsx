"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useModal } from "@/context/ModalContext";

export default function Navbar() {
  const { user, isLoggedIn, loading, logout } = useAuth();
  const { showConfirm } = useModal();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    const confirmed = await showConfirm(
      "warning",
      "ออกจากระบบ",
      "คุณต้องการออกจากระบบหรือไม่?",
      "ออกจากระบบ",
      "ยกเลิก"
    );
    
    if (confirmed) {
      await logout();
      router.push("/auth/login");
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-900/95 border-b border-zinc-200 dark:border-zinc-800 shadow-sm backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo & Navigation */}
          <div className="flex items-center gap-4 lg:gap-8">
            <Link 
              href={isLoggedIn ? "/dashboard" : "/"} 
              className="text-xl sm:text-2xl font-bold bg-linear-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent"
              onClick={closeMobileMenu}
            >
              SlipShot
            </Link>
            {isLoggedIn && (
              <div className="hidden md:flex items-center gap-1">
                <NavLink href="/dashboard">แดชบอร์ด</NavLink>
                <NavLink href="/slip">สลิป</NavLink>
                <NavLink href="/tag">หมวดหมู่</NavLink>
                {user?.is_staff && (
                  <NavLink href="/admin">จัดการระบบ</NavLink>
                )}
              </div>
            )}
          </div>
          
          {/* User Menu - Desktop */}
          <div className="hidden sm:flex items-center gap-3">
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-20 h-4 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"></div>
                <div className="w-24 h-9 bg-zinc-200 dark:bg-zinc-700 rounded-lg animate-pulse"></div>
              </div>
            ) : isLoggedIn ? (
              <>
                {user && (
                  <Link 
                    href="/profile"
                    className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-medium">
                        {user.first_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <span className="font-medium hidden lg:inline">{user.first_name} {user.last_name}</span>
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                >
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <>
                <Link 
                  href="/auth/login" 
                  className="px-3 py-2 text-sm font-medium rounded-lg text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link 
                  href="/auth/register" 
                  className="px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            {mobileMenuOpen ? (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-zinc-200 dark:border-zinc-800 py-4">
            {loading ? (
              <div className="px-4 py-2">
                <div className="w-full h-10 bg-zinc-200 dark:bg-zinc-700 rounded animate-pulse"></div>
              </div>
            ) : isLoggedIn ? (
              <div className="space-y-1">
                {user && (
                  <Link
                    href="/profile"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-3 px-4 py-3 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 font-medium text-lg">
                        {user.first_name?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{user.first_name} {user.last_name}</div>
                      <div className="text-sm text-zinc-500">@{user.username}</div>
                    </div>
                  </Link>
                )}
                <div className="border-t border-zinc-200 dark:border-zinc-800 my-2"></div>
                <MobileNavLink href="/dashboard" onClick={closeMobileMenu}>แดชบอร์ด</MobileNavLink>
                <MobileNavLink href="/slip" onClick={closeMobileMenu}>สลิป</MobileNavLink>
                <MobileNavLink href="/tag" onClick={closeMobileMenu}>หมวดหมู่</MobileNavLink>
                {user?.is_staff && (
                  <MobileNavLink href="/admin" onClick={closeMobileMenu}>จัดการระบบ</MobileNavLink>
                )}
                <div className="border-t border-zinc-200 dark:border-zinc-800 my-2"></div>
                <button
                  onClick={() => { closeMobileMenu(); handleLogout(); }}
                  className="w-full text-left px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  ออกจากระบบ
                </button>
              </div>
            ) : (
              <div className="space-y-2 px-4">
                <Link
                  href="/auth/login"
                  onClick={closeMobileMenu}
                  className="block w-full py-3 text-center font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/auth/register"
                  onClick={closeMobileMenu}
                  className="block w-full py-3 text-center font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  สมัครสมาชิก
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + '/');
  
  return (
    <Link 
      href={href}
      className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        isActive 
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
          : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
      }`}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({ href, children, onClick }: { href: string; children: React.ReactNode; onClick: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname?.startsWith(href + '/');
  
  return (
    <Link 
      href={href}
      onClick={onClick}
      className={`block px-4 py-3 font-medium rounded-lg transition-colors ${
        isActive 
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' 
          : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
      }`}
    >
      {children}
    </Link>
  );
}
