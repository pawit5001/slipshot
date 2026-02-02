// Form persistence utility - stores form data in localStorage with TTL

const FORM_STORAGE_KEY = "slipshot_form_cache";
const DEFAULT_TTL = 30 * 60 * 1000; // 30 minutes

interface FormCacheEntry {
  data: Record<string, unknown>;
  timestamp: number;
  ttl: number;
}

interface FormCache {
  [formId: string]: FormCacheEntry;
}

/**
 * Save form data to localStorage with TTL
 */
export function saveFormData(formId: string, data: unknown, ttl = DEFAULT_TTL): void {
  if (typeof window === "undefined") return;
  
  try {
    const cache: FormCache = JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || "{}");
    
    // Clean up expired entries
    const now = Date.now();
    Object.keys(cache).forEach(key => {
      if (now - cache[key].timestamp > cache[key].ttl) {
        delete cache[key];
      }
    });
    
    // Save new entry
    cache[formId] = {
      data: data as Record<string, unknown>,
      timestamp: now,
      ttl,
    };
    
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Failed to save form data:", error);
  }
}

/**
 * Load form data from localStorage (returns null if expired or not found)
 */
export function loadFormData<T>(formId: string): T | null {
  if (typeof window === "undefined") return null;
  
  try {
    const cache: FormCache = JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || "{}");
    const entry = cache[formId];
    
    if (!entry) return null;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Expired - remove and return null
      delete cache[formId];
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(cache));
      return null;
    }
    
    return entry.data as T;
  } catch (error) {
    console.error("Failed to load form data:", error);
    return null;
  }
}

/**
 * Clear specific form data
 */
export function clearFormData(formId: string): void {
  if (typeof window === "undefined") return;
  
  try {
    const cache: FormCache = JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || "{}");
    delete cache[formId];
    localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.error("Failed to clear form data:", error);
  }
}

/**
 * Clear all expired form data
 */
export function cleanupExpiredForms(): void {
  if (typeof window === "undefined") return;
  
  try {
    const cache: FormCache = JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || "{}");
    const now = Date.now();
    
    let hasChanges = false;
    Object.keys(cache).forEach(key => {
      if (now - cache[key].timestamp > cache[key].ttl) {
        delete cache[key];
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(cache));
    }
  } catch (error) {
    console.error("Failed to cleanup form data:", error);
  }
}


