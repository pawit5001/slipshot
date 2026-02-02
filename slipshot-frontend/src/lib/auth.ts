/**
 * Authentication Service - Singleton pattern for managing auth state
 * Implements industry-standard token refresh with:
 * - Request queuing during refresh
 * - Max retry limits to prevent infinite loops
 * - Cooldown period between refresh attempts
 * - Proper error handling and session management
 */

import { API_ENDPOINTS } from './config';

// Error codes from backend
export type AuthErrorCode = 
  | 'REFRESH_TOKEN_MISSING'
  | 'REFRESH_TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_REVOKED'
  | 'REFRESH_TOKEN_INVALID'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR';

export class AuthError extends Error {
  code: AuthErrorCode;
  
  constructor(message: string, code: AuthErrorCode) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

interface RefreshResponse {
  detail?: string;
  authenticated?: boolean;
  error?: string;
  code?: AuthErrorCode;
}

type QueuedRequest = {
  resolve: (value: boolean) => void;
  reject: (error: AuthError) => void;
};

class AuthService {
  private static instance: AuthService;
  
  // Refresh state management
  private isRefreshing = false;
  private refreshQueue: QueuedRequest[] = [];
  
  // Anti-spam protection
  private lastRefreshAttempt = 0;
  private refreshCooldown = 2000; // 2 seconds cooldown between refresh attempts
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 3;
  
  // Session state
  private isSessionExpired = false;
  private isRedirecting = false;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Check if we should attempt a refresh
   */
  private canAttemptRefresh(): boolean {
    // Don't refresh if session is already marked expired
    if (this.isSessionExpired || this.isRedirecting) {
      return false;
    }

    // Check cooldown period
    const now = Date.now();
    if (now - this.lastRefreshAttempt < this.refreshCooldown) {
      console.log('[Auth] Refresh cooldown active, skipping');
      return false;
    }

    // Check max consecutive failures
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      console.log('[Auth] Max refresh failures reached, marking session expired');
      this.markSessionExpired();
      return false;
    }

    return true;
  }

  /**
   * Attempt to refresh the access token
   * Returns a promise that resolves to true if refresh succeeded
   */
  async refreshToken(): Promise<boolean> {
    // If already refreshing, queue this request
    if (this.isRefreshing) {
      return new Promise((resolve, reject) => {
        this.refreshQueue.push({ resolve, reject });
      });
    }

    // Check if we can attempt refresh
    if (!this.canAttemptRefresh()) {
      throw new AuthError('Cannot refresh token', 'SESSION_EXPIRED');
    }

    this.isRefreshing = true;
    this.lastRefreshAttempt = Date.now();

    try {
      console.log('[Auth] Attempting token refresh...');
      
      const response = await fetch(API_ENDPOINTS.REFRESH_TOKEN, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: RefreshResponse = await response.json().catch(() => ({}));

      if (response.ok) {
        console.log('[Auth] Token refresh successful');
        this.consecutiveFailures = 0;
        this.resolveQueue(true);
        return true;
      }

      // Handle specific error codes
      const errorCode = data.code || this.getErrorCode(response.status, data.error);
      console.log(`[Auth] Token refresh failed: ${errorCode}`);
      
      this.consecutiveFailures++;
      
      // Check if this is a terminal failure (don't retry)
      if (this.isTerminalError(errorCode)) {
        this.markSessionExpired();
        const error = new AuthError(data.error || 'Session expired', errorCode);
        this.rejectQueue(error);
        throw error;
      }

      this.resolveQueue(false);
      return false;

    } catch (error) {
      console.error('[Auth] Token refresh error:', error);
      this.consecutiveFailures++;
      
      if (error instanceof AuthError) {
        this.rejectQueue(error);
        throw error;
      }

      // Network error - might be temporary
      const authError = new AuthError('Network error during refresh', 'NETWORK_ERROR');
      this.resolveQueue(false);
      return false;

    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Get error code from response
   */
  private getErrorCode(status: number, errorMessage?: string): AuthErrorCode {
    if (errorMessage?.toLowerCase().includes('expired')) {
      return 'REFRESH_TOKEN_EXPIRED';
    }
    if (errorMessage?.toLowerCase().includes('missing') || errorMessage?.toLowerCase().includes('not found')) {
      return 'REFRESH_TOKEN_MISSING';
    }
    if (errorMessage?.toLowerCase().includes('revoked') || errorMessage?.toLowerCase().includes('blacklist')) {
      return 'REFRESH_TOKEN_REVOKED';
    }
    return 'REFRESH_TOKEN_INVALID';
  }

  /**
   * Check if error is terminal (should not retry)
   */
  private isTerminalError(code: AuthErrorCode): boolean {
    return [
      'REFRESH_TOKEN_EXPIRED',
      'REFRESH_TOKEN_REVOKED',
      'REFRESH_TOKEN_MISSING',
    ].includes(code);
  }

  /**
   * Resolve all queued refresh requests
   */
  private resolveQueue(success: boolean): void {
    const queue = [...this.refreshQueue];
    this.refreshQueue = [];
    queue.forEach(({ resolve }) => resolve(success));
  }

  /**
   * Reject all queued refresh requests
   */
  private rejectQueue(error: AuthError): void {
    const queue = [...this.refreshQueue];
    this.refreshQueue = [];
    queue.forEach(({ reject }) => reject(error));
  }

  /**
   * Mark session as expired and redirect to login
   */
  markSessionExpired(): void {
    if (this.isSessionExpired) return;
    
    console.log('[Auth] Session expired, redirecting to login');
    this.isSessionExpired = true;
    
    if (typeof window !== 'undefined' && !this.isRedirecting) {
      this.isRedirecting = true;
      // Small delay to allow current operations to complete
      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 100);
    }
  }

  /**
   * Reset auth state (call after successful login)
   */
  reset(): void {
    this.isRefreshing = false;
    this.refreshQueue = [];
    this.lastRefreshAttempt = 0;
    this.consecutiveFailures = 0;
    this.isSessionExpired = false;
    this.isRedirecting = false;
    console.log('[Auth] Auth state reset');
  }

  /**
   * Check if session is currently valid
   */
  isSessionValid(): boolean {
    return !this.isSessionExpired && !this.isRedirecting;
  }

  /**
   * Get current auth state for debugging
   */
  getState() {
    return {
      isRefreshing: this.isRefreshing,
      queueLength: this.refreshQueue.length,
      consecutiveFailures: this.consecutiveFailures,
      isSessionExpired: this.isSessionExpired,
      isRedirecting: this.isRedirecting,
    };
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
