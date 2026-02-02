"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS } from "@/lib/config";
import { authService } from "@/lib/auth";
import type { User } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  refreshUser: (force?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Public paths that don't require authentication
const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const isRefreshingRef = useRef(false);

  const refreshUser = useCallback(async (force = false) => {
    // Prevent multiple simultaneous refresh calls
    if (isRefreshingRef.current) {
      return;
    }

    // Skip auth check on public paths (unless forced)
    if (!force && typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (PUBLIC_PATHS.includes(pathname)) {
        setLoading(false);
        setInitialized(true);
        return;
      }
    }

    // Check if session is already marked as expired (unless forced)
    if (!force && !authService.isSessionValid()) {
      setUser(null);
      setIsLoggedIn(false);
      setLoading(false);
      setInitialized(true);
      return;
    }

    isRefreshingRef.current = true;
    
    try {
      const res = await api.get<User>(API_ENDPOINTS.USER_PROFILE);
      if (res.ok && res.data) {
        setUser(res.data);
        setIsLoggedIn(true);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setUser(null);
        setIsLoggedIn(false);
      } else {
        setUser(null);
        setIsLoggedIn(false);
      }
    } finally {
      setLoading(false);
      setInitialized(true);
      isRefreshingRef.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post(API_ENDPOINTS.LOGOUT);
    } finally {
      setUser(null);
      setIsLoggedIn(false);
      authService.reset();
    }
  }, []);

  useEffect(() => {
    if (!initialized) {
      refreshUser();
    }
  }, [initialized, refreshUser]);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, loading, refreshUser, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
