// LocalStorage cache utility with TTL (Time To Live)

const CACHE_PREFIX = 'slipshot_cache_';
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export function setCache<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  if (typeof window === 'undefined') return;
  
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (e) {
    // localStorage might be full or disabled
    console.warn('Failed to save cache:', e);
  }
}

export function getCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    
    const item: CacheItem<T> = JSON.parse(raw);
    
    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    
    return item.data;
  } catch (e) {
    return null;
  }
}

export function clearCache(key?: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    if (key) {
      localStorage.removeItem(CACHE_PREFIX + key);
    } else {
      // Clear all cache items
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  } catch (e) {
    console.warn('Failed to clear cache:', e);
  }
}

// Cache keys
export const CACHE_KEYS = {
  TAGS: 'tags',
  SLIPS: 'slips',
  DASHBOARD: 'dashboard',
  USER_SETTINGS: 'user_settings',
} as const;

// User settings interface
export interface UserSettings {
  useOcrDateTime: boolean; // true = use OCR date/time, false = use current
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  useOcrDateTime: false, // default: use current date/time
};

export function getUserSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_USER_SETTINGS;
  
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + CACHE_KEYS.USER_SETTINGS);
    if (!raw) return DEFAULT_USER_SETTINGS;
    return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function setUserSettings(settings: Partial<UserSettings>): void {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getUserSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem(CACHE_PREFIX + CACHE_KEYS.USER_SETTINGS, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save user settings:', e);
  }
}
