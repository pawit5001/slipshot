"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS } from "@/lib/config";
import type { User } from "@/lib/types";

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  const refreshUser = useCallback(async () => {
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
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post(API_ENDPOINTS.LOGOUT);
    } finally {
      setUser(null);
      setIsLoggedIn(false);
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
