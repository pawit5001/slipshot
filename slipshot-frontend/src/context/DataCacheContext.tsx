"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS } from "@/lib/config";
import { setCache, getCache, clearCache, CACHE_KEYS } from "@/lib/cache";
import type { Tag, Slip, DashboardData } from "@/lib/types";

// Cache TTL: 10 minutes for data
const CACHE_TTL = 10 * 60 * 1000;

interface DataCacheContextType {
  // Tags
  tags: Tag[];
  tagsLoading: boolean;
  fetchTags: (force?: boolean) => Promise<Tag[]>;
  invalidateTags: () => void;
  
  // Slips
  slips: Slip[];
  slipsLoading: boolean;
  fetchSlips: (force?: boolean) => Promise<Slip[]>;
  invalidateSlips: () => void;
  
  // Dashboard
  dashboardData: DashboardData | null;
  dashboardLoading: boolean;
  fetchDashboard: (params?: { period_type?: string; period_value?: string }, force?: boolean) => Promise<DashboardData | null>;
  invalidateDashboard: () => void;
  
  // Invalidate all
  invalidateAll: () => void;
}

const DataCacheContext = createContext<DataCacheContextType | undefined>(undefined);

export function DataCacheProvider({ children }: { children: ReactNode }) {
  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const tagsLoadedRef = useRef(false);
  
  // Slips state
  const [slips, setSlips] = useState<Slip[]>([]);
  const [slipsLoading, setSlipsLoading] = useState(false);
  const slipsLoadedRef = useRef(false);
  
  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const dashboardLoadedRef = useRef(false);
  const lastDashboardParamsRef = useRef<string>('');
  
  // Use ref to track current data without causing re-renders
  const tagsRef = useRef<Tag[]>([]);
  const slipsRef = useRef<Slip[]>([]);
  const dashboardDataRef = useRef<DashboardData | null>(null);
  
  // Fetch in progress flags to prevent duplicate calls
  const tagsFetchingRef = useRef(false);
  const slipsFetchingRef = useRef(false);
  const dashboardFetchingRef = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    // Load cached tags
    const cachedTags = getCache<Tag[]>(CACHE_KEYS.TAGS);
    if (cachedTags && cachedTags.length > 0) {
      setTags(cachedTags);
      tagsRef.current = cachedTags;
      tagsLoadedRef.current = true;
    }
    
    // Load cached slips
    const cachedSlips = getCache<Slip[]>(CACHE_KEYS.SLIPS);
    if (cachedSlips && cachedSlips.length > 0) {
      setSlips(cachedSlips);
      slipsRef.current = cachedSlips;
      slipsLoadedRef.current = true;
    }
  }, []);

  const fetchTags = useCallback(async (force = false): Promise<Tag[]> => {
    // Return cached data if available and not forcing
    if (tagsLoadedRef.current && !force && tagsRef.current.length > 0) {
      return tagsRef.current;
    }
    
    // Check localStorage cache
    if (!force) {
      const cached = getCache<Tag[]>(CACHE_KEYS.TAGS);
      if (cached && cached.length > 0) {
        setTags(cached);
        tagsRef.current = cached;
        tagsLoadedRef.current = true;
        return cached;
      }
    }
    
    // Prevent duplicate concurrent requests
    if (tagsFetchingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return tagsRef.current;
    }
    
    tagsFetchingRef.current = true;
    setTagsLoading(true);
    try {
      const res = await api.get<Tag[]>(API_ENDPOINTS.TAGS);
      if (res.ok && res.data) {
        setTags(res.data);
        tagsRef.current = res.data;
        tagsLoadedRef.current = true;
        // Save to localStorage
        setCache(CACHE_KEYS.TAGS, res.data, CACHE_TTL);
        return res.data;
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        throw err;
      }
    } finally {
      setTagsLoading(false);
      tagsFetchingRef.current = false;
    }
    return [];
  }, []);

  const invalidateTags = useCallback(() => {
    tagsLoadedRef.current = false;
    clearCache(CACHE_KEYS.TAGS);
  }, []);

  const fetchSlips = useCallback(async (force = false): Promise<Slip[]> => {
    // Return cached data if available and not forcing
    if (slipsLoadedRef.current && !force && slipsRef.current.length > 0) {
      return slipsRef.current;
    }
    
    // Check localStorage cache
    if (!force) {
      const cached = getCache<Slip[]>(CACHE_KEYS.SLIPS);
      if (cached && cached.length > 0) {
        setSlips(cached);
        slipsRef.current = cached;
        slipsLoadedRef.current = true;
        return cached;
      }
    }
    
    // Prevent duplicate concurrent requests
    if (slipsFetchingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return slipsRef.current;
    }
    
    slipsFetchingRef.current = true;
    setSlipsLoading(true);
    try {
      const res = await api.get<Slip[]>(API_ENDPOINTS.SLIPS);
      if (res.ok && res.data) {
        setSlips(res.data);
        slipsRef.current = res.data;
        slipsLoadedRef.current = true;
        // Save to localStorage
        setCache(CACHE_KEYS.SLIPS, res.data, CACHE_TTL);
        return res.data;
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        throw err;
      }
    } finally {
      setSlipsLoading(false);
      slipsFetchingRef.current = false;
    }
    return [];
  }, []);

  const invalidateSlips = useCallback(() => {
    slipsLoadedRef.current = false;
    clearCache(CACHE_KEYS.SLIPS);
  }, []);

  const fetchDashboard = useCallback(async (
    params?: { period_type?: string; period_value?: string },
    force = false
  ): Promise<DashboardData | null> => {
    const paramsKey = JSON.stringify(params || {});
    const cacheKey = `${CACHE_KEYS.DASHBOARD}_${paramsKey}`;
    
    // Return cached data if available, params match, and not forcing
    if (dashboardLoadedRef.current && !force && lastDashboardParamsRef.current === paramsKey && dashboardDataRef.current) {
      return dashboardDataRef.current;
    }
    
    // Check localStorage cache
    if (!force) {
      const cached = getCache<DashboardData>(cacheKey);
      if (cached) {
        setDashboardData(cached);
        dashboardDataRef.current = cached;
        dashboardLoadedRef.current = true;
        lastDashboardParamsRef.current = paramsKey;
        return cached;
      }
    }
    
    // Prevent duplicate concurrent requests
    if (dashboardFetchingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return dashboardDataRef.current;
    }
    
    dashboardFetchingRef.current = true;
    setDashboardLoading(true);
    try {
      let url = API_ENDPOINTS.DASHBOARD;
      if (params) {
        const searchParams = new URLSearchParams();
        if (params.period_type) searchParams.set('period_type', params.period_type);
        if (params.period_value) searchParams.set('period_value', params.period_value);
        url += '?' + searchParams.toString();
      }
      
      const res = await api.get<DashboardData>(url);
      if (res.ok && res.data) {
        setDashboardData(res.data);
        dashboardDataRef.current = res.data;
        dashboardLoadedRef.current = true;
        lastDashboardParamsRef.current = paramsKey;
        // Save to localStorage
        setCache(cacheKey, res.data, CACHE_TTL);
        return res.data;
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        throw err;
      }
    } finally {
      setDashboardLoading(false);
      dashboardFetchingRef.current = false;
    }
    return null;
  }, []);

  const invalidateDashboard = useCallback(() => {
    dashboardLoadedRef.current = false;
    // Clear all dashboard caches
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.includes(CACHE_KEYS.DASHBOARD)) {
          keysToRemove.push(k.replace('slipshot_cache_', ''));
        }
      }
      keysToRemove.forEach(k => clearCache(k));
    }
  }, []);

  const invalidateAll = useCallback(() => {
    tagsLoadedRef.current = false;
    slipsLoadedRef.current = false;
    dashboardLoadedRef.current = false;
    clearCache(); // Clear all caches
  }, []);

  return (
    <DataCacheContext.Provider value={{
      tags,
      tagsLoading,
      fetchTags,
      invalidateTags,
      slips,
      slipsLoading,
      fetchSlips,
      invalidateSlips,
      dashboardData,
      dashboardLoading,
      fetchDashboard,
      invalidateDashboard,
      invalidateAll,
    }}>
      {children}
    </DataCacheContext.Provider>
  );
}

export function useDataCache() {
  const context = useContext(DataCacheContext);
  if (context === undefined) {
    throw new Error("useDataCache must be used within a DataCacheProvider");
  }
  return context;
}
