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
  SLIP_QR_SCAN: `${API_BASE_URL}/api/slips/scan-qr/`,
  SLIP_BULK_UPLOAD: `${API_BASE_URL}/api/slips/bulk_upload/`,
  
  // Tags
  TAGS: `${API_BASE_URL}/api/tags/`,
  
  // Dashboard
  DASHBOARD: `${API_BASE_URL}/api/dashboard/`,
} as const;

// Helper function to get slip by id
export const getSlipUrl = (id: number | string) => `${API_ENDPOINTS.SLIPS}${id}/`;
export const getTagUrl = (id: number | string) => `${API_ENDPOINTS.TAGS}${id}/`;
