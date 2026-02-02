// API Configuration - centralized config for all API calls
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: `${API_BASE_URL}/api/auth/token/cookie/`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout/`,
  REGISTER: `${API_BASE_URL}/api/register/`,
  REFRESH_TOKEN: `${API_BASE_URL}/api/auth/token/refresh/`,
  CHANGE_PASSWORD: `${API_BASE_URL}/api/auth/change_password/`,
  
  // User
  USER_PROFILE: `${API_BASE_URL}/api/users/me/`,
  
  // Slips
  SLIPS: `${API_BASE_URL}/api/slips/`,
  SLIP_OCR: `${API_BASE_URL}/api/slips/ocr/`,
  SLIP_BULK_UPLOAD: `${API_BASE_URL}/api/slips/bulk_upload/`,
  
  // Tags
  TAGS: `${API_BASE_URL}/api/tags/`,
  
  // Dashboard
  DASHBOARD: `${API_BASE_URL}/api/dashboard/`,
} as const;

// Helper function to get slip by id
export const getSlipUrl = (id: number | string) => `${API_ENDPOINTS.SLIPS}${id}/`;
export const getTagUrl = (id: number | string) => `${API_ENDPOINTS.TAGS}${id}/`;

// Thailand timezone utilities
export const THAILAND_TIMEZONE = 'Asia/Bangkok';

/**
 * Get current date in Thailand timezone as YYYY-MM-DD string
 */
export function getThaiDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: THAILAND_TIMEZONE });
}

/**
 * Get current time in Thailand timezone as HH:MM string
 */
export function getThaiTime(): string {
  return new Date().toLocaleTimeString('en-GB', { 
    timeZone: THAILAND_TIMEZONE, 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

/**
 * Get current year in Thailand timezone
 */
export function getThaiYear(): number {
  return parseInt(new Date().toLocaleDateString('en-US', { 
    timeZone: THAILAND_TIMEZONE, 
    year: 'numeric' 
  }));
}

/**
 * Get current month in Thailand timezone (1-12)
 */
export function getThaiMonth(): number {
  return parseInt(new Date().toLocaleDateString('en-US', { 
    timeZone: THAILAND_TIMEZONE, 
    month: 'numeric' 
  }));
}

/**
 * Format date for display in Thai locale
 */
export function formatThaiDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH', { 
    timeZone: THAILAND_TIMEZONE,
    ...options 
  });
}

/**
 * Format datetime for display in Thai locale
 */
export function formatThaiDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('th-TH', { timeZone: THAILAND_TIMEZONE });
}
