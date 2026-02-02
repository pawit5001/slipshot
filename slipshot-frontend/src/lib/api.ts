/**
 * Centralized API client with proper authentication handling
 * Uses AuthService for token refresh with anti-spam protection
 * 
 * Features:
 * - Automatic token refresh on 401
 * - Request queuing during refresh
 * - Max retry limits to prevent infinite loops
 * - Cooldown period between refresh attempts
 */

import { authService, AuthError } from './auth';

export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  ok: boolean;
}

export interface ApiErrorResponse {
  detail?: string;
  error?: string;
  code?: string;
  [key: string]: unknown;
}

/**
 * Make an authenticated API request with automatic token refresh
 */
export async function fetchWithAuth<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { retry?: boolean; retryCount?: number }
): Promise<ApiResponse<T>> {
  const { retry = true, retryCount = 0 } = options || {};
  const maxRetries = 1; // Only retry once after refresh

  // Check if session is still valid
  if (!authService.isSessionValid()) {
    return {
      status: 401,
      ok: false,
      error: 'Session expired',
    };
  }

  try {
    const response = await fetch(input, {
      ...init,
      credentials: 'include',
    });

    // Handle 401 Unauthorized
    if (response.status === 401 && retry && retryCount < maxRetries) {
      try {
        const refreshed = await authService.refreshToken();
        
        if (refreshed) {
          // Retry the original request
          return fetchWithAuth<T>(input, init, { 
            retry: false, 
            retryCount: retryCount + 1 
          });
        }
      } catch (error) {
        if (error instanceof AuthError) {
          // Session is expired, authService will handle redirect
          return {
            status: 401,
            ok: false,
            error: error.message,
          };
        }
      }
      
      // Refresh failed, mark session expired
      authService.markSessionExpired();
      return {
        status: 401,
        ok: false,
        error: 'Session expired',
      };
    }

    // Parse response
    let data: T | undefined;
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      try {
        data = await response.json();
      } catch {
        // Response body is not valid JSON
      }
    }

    // Extract error message if not ok
    let errorMessage: string | undefined;
    if (!response.ok && data) {
      const errorData = data as ApiErrorResponse;
      errorMessage = errorData.detail || errorData.error || 'Request failed';
    }

    return {
      data,
      status: response.status,
      ok: response.ok,
      error: errorMessage,
    };

  } catch (error) {
    // Network error
    console.error('[API] Network error:', error);
    return {
      status: 0,
      ok: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Convenience methods
export const api = {
  get: <T = unknown>(url: string) => fetchWithAuth<T>(url),
  
  post: <T = unknown>(url: string, body?: unknown, isFormData = false) =>
    fetchWithAuth<T>(url, {
      method: 'POST',
      headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
      body: isFormData ? (body as FormData) : JSON.stringify(body),
    }),

  postForm: <T = unknown>(url: string, formData: FormData) =>
    fetchWithAuth<T>(url, {
      method: 'POST',
      body: formData,
    }),
  
  put: <T = unknown>(url: string, body?: unknown) =>
    fetchWithAuth<T>(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  patch: <T = unknown>(url: string, body?: unknown) =>
    fetchWithAuth<T>(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  
  delete: <T = unknown>(url: string) =>
    fetchWithAuth<T>(url, { method: 'DELETE' }),

  // Generic request method for custom configurations
  request: <T = unknown>(url: string, init?: RequestInit) =>
    fetchWithAuth<T>(url, init),
    
  // Reset auth state (call this after successful login)
  resetAuth: () => {
    authService.reset();
  },

  // Check if session is valid
  isAuthenticated: () => authService.isSessionValid(),

  // Get auth state for debugging
  getAuthState: () => authService.getState(),
};

// Re-export for convenience
export { authService, AuthError } from './auth';
export type { AuthErrorCode } from './auth';

// Backwards compatibility - SessionExpiredError is now AuthError
export const SessionExpiredError = AuthError;
