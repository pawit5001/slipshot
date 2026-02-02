"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import Footer from "./Footer";

const Navbar = dynamic(() => import("./Navbar"), { ssr: false });

// Routes where navbar should not add padding (full-screen pages)
const FULL_SCREEN_ROUTES = ["/auth/login", "/auth/register"];
// Routes where footer should not show
const NO_FOOTER_ROUTES = ["/auth/login", "/auth/register"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreenPage = FULL_SCREEN_ROUTES.some(route => pathname?.startsWith(route));
  // Show navbar on home page too, but with different layout
  const isHomePage = pathname === "/";
  const showFooter = !NO_FOOTER_ROUTES.some(route => pathname?.startsWith(route));

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className={`flex-1 ${isFullScreenPage ? "pt-16" : isHomePage ? "" : "pt-20"}`}>
        {children}
      </main>
      {showFooter && !isHomePage && <Footer />}
    </div>
  );
}
