'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, SessionExpiredError } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/config';
import type { User } from '@/lib/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

const PUBLIC_PATHS = ['/auth/login', '/auth/register', '/'];

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });
  
  const router = useRouter();
  const pathname = usePathname();

  const checkSession = useCallback(async () => {
    // Skip auth check on public paths
    if (PUBLIC_PATHS.includes(pathname)) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    try {
      const { data, ok } = await api.get<User>(API_ENDPOINTS.USER_PROFILE);
      
      if (ok && data) {
        setState({
          user: data,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
      } else {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: null,
        });
      }
    } catch (error) {
      if (error instanceof SessionExpiredError) {
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
          error: 'Session expired',
        });
      }
    }
  }, [pathname]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const logout = useCallback(async () => {
    try {
      await api.post(API_ENDPOINTS.LOGOUT);
    } catch {
      // Ignore logout errors
    }
    setState({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
    });
    router.push('/auth/login');
  }, [router]);

  const refreshUser = useCallback(async () => {
    await checkSession();
  }, [checkSession]);

  return {
    ...state,
    logout,
    refreshUser,
    fullName: state.user ? `${state.user.first_name} ${state.user.last_name}`.trim() : '',
  };
}
