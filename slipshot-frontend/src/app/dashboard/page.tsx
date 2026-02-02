"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS, API_BASE_URL, getThaiDate, getThaiYear, getThaiMonth, THAILAND_TIMEZONE } from "@/lib/config";
import type { DashboardData, TagBreakdown, DailyTrend, RecentSlip } from "@/lib/types";

type PeriodType = "day" | "week" | "month" | "year";

interface LeaderboardUser {
  rank?: number;
  display_name: string;
  slip_count: number;
  total_amount: number;
  is_me: boolean;
}

interface LeaderboardData {
  top_users: LeaderboardUser[];
  recent_active: LeaderboardUser[];
  my_rank: number;
  my_slip_count: number;
  my_user_data: LeaderboardUser | null;
}

// Helper: get Monday of current week
function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// Soft color palette for charts
const COLORS = [
  "#60a5fa", "#f87171", "#4ade80", "#fbbf24", "#a78bfa",
  "#f472b6", "#22d3ee", "#a3e635", "#fb923c", "#818cf8"
];

// Cache type for storing dashboard data
type CacheEntry = {
  data: DashboardData;
  timestamp: number;
};

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null);
  const [periodType, setPeriodType] = useState<PeriodType>("day");
  const [periodValue, setPeriodValue] = useState(() => getThaiDate());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Cache for dashboard data
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());

  const handlePeriodTypeChange = (newType: PeriodType) => {
    setPeriodType(newType);
    switch (newType) {
      case "day":
        setPeriodValue(getThaiDate());
        break;
      case "week":
        // Get Monday of current week in Thailand timezone
        const now = new Date();
        const thaiNow = new Date(now.toLocaleString('en-US', { timeZone: THAILAND_TIMEZONE }));
        setPeriodValue(getMonday(thaiNow).toISOString().split("T")[0]);
        break;
      case "month":
        setPeriodValue(`${getThaiYear()}-${String(getThaiMonth()).padStart(2, "0")}`);
        break;
      case "year":
        setPeriodValue(getThaiYear().toString());
        break;
    }
  };

  const fetchData = useCallback(async (forceRefresh = false) => {
    const cacheKey = `${periodType}-${periodValue}`;
    const now = Date.now();
    
    // Check cache first
    const cached = cacheRef.current.get(cacheKey);
    if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_TTL) {
      setData(cached.data);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      const url = `${API_ENDPOINTS.DASHBOARD}?period_type=${periodType}&period_value=${periodValue}`;
      const res = await api.get<DashboardData>(url);
      
      if (res.ok && res.data) {
        setData(res.data);
        // Store in cache
        cacheRef.current.set(cacheKey, {
          data: res.data,
          timestamp: now,
        });
      } else {
        setError(res.error || "โหลดข้อมูลไม่สำเร็จ");
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      } else {
        setError("โหลดข้อมูลไม่สำเร็จ");
      }
    } finally {
      setLoading(false);
    }
  }, [periodType, periodValue]);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await api.get<LeaderboardData>(`${API_BASE_URL}/api/leaderboard/`);
      if (res.ok && res.data) {
        setLeaderboard(res.data);
      }
    } catch {
      // Leaderboard is optional, don't show error
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchLeaderboard();
  }, [fetchData, fetchLeaderboard]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  const getPeriodLabel = () => {
    switch (periodType) {
      case "day": return "รายวัน";
      case "week": return "รายสัปดาห์";
      case "month": return "รายเดือน";
      case "year": return "รายปี";
    }
  };

  // Calculate analytics
  const analytics = useMemo(() => {
    if (!data) return null;
    
    const totalExpense = data.expense || 0;
    const totalIncome = data.income || 0;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100) : 0;
    const avgDaily = data.daily_trend && data.daily_trend.length > 0 
      ? data.daily_trend.reduce((sum, d) => sum + d.expense, 0) / data.daily_trend.length 
      : 0;
    
    return {
      totalExpense,
      savingsRate,
      avgDaily,
      transactionCount: data.slip_count || 0,
    };
  }, [data]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded-lg w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-zinc-200 dark:bg-zinc-700 rounded-2xl h-32"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-zinc-200 dark:bg-zinc-700 rounded-2xl h-80"></div>
            <div className="bg-zinc-200 dark:bg-zinc-700 rounded-2xl h-80"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            ภาพรวมการเงินและการวิเคราะห์ข้อมูล
          </p>
        </div>
        
        {/* Period Selector */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            title="เลือกช่วงเวลา"
            value={periodType}
            onChange={(e) => handlePeriodTypeChange(e.target.value as PeriodType)}
          >
            <option value="day">รายวัน</option>
            <option value="week">รายสัปดาห์</option>
            <option value="month">รายเดือน</option>
            <option value="year">รายปี</option>
          </select>
          
          {periodType === "day" && (
            <input
              type="date"
              title="เลือกวันที่"
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
            />
          )}
          {periodType === "week" && (
            <input
              type="date"
              title="เลือกสัปดาห์"
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
            />
          )}
          {periodType === "month" && (
            <input
              type="month"
              title="เลือกเดือน"
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
            />
          )}
          {periodType === "year" && (
            <input
              type="number"
              title="เลือกปี"
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white text-sm w-28 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={periodValue}
              onChange={(e) => setPeriodValue(e.target.value)}
              min="2000"
              max="2100"
            />
          )}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => fetchData(true)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition"
          >
            ลองใหม่
          </button>
        </div>
      ) : data ? (
        <>
          {/* Main Stats Cards - Soft colors */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {/* Income Card - Soft Green */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">รายรับ</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                ฿{formatCompactCurrency(data.income)}
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">{getPeriodLabel()}</p>
            </div>

            {/* Expense Card - Soft Red */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                  <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">รายจ่าย</span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-rose-600 dark:text-rose-400">
                ฿{formatCompactCurrency(data.expense)}
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">{data.slip_count || 0} รายการ</p>
            </div>

            {/* Balance Card - Blue/Amber */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2.5 rounded-xl ${
                  data.balance >= 0 
                    ? 'bg-blue-100 dark:bg-blue-900/30' 
                    : 'bg-amber-100 dark:bg-amber-900/30'
                }`}>
                  <svg className={`w-5 h-5 ${
                    data.balance >= 0 
                      ? 'text-blue-600 dark:text-blue-400' 
                      : 'text-amber-600 dark:text-amber-400'
                  }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">ยอดคงเหลือ</span>
              </div>
              <p className={`text-2xl sm:text-3xl font-bold ${
                data.balance >= 0 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
                {data.balance >= 0 ? '' : '-'}฿{formatCompactCurrency(Math.abs(data.balance))}
              </p>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 mt-1">
                {data.balance >= 0 ? 'เหลือเก็บ' : 'ขาดทุน'}
              </p>
            </div>
          </div>

          {/* Analytics Insights */}
          {analytics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">อัตราการออม</p>
                <p className={`text-2xl font-bold mt-1 ${
                  analytics.savingsRate >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {analytics.savingsRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">เฉลี่ย/วัน</p>
                <p className="text-2xl font-bold mt-1 text-zinc-900 dark:text-white">
                  ฿{formatCompactCurrency(analytics.avgDaily)}
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">จำนวนรายการ</p>
                <p className="text-2xl font-bold mt-1 text-zinc-900 dark:text-white">
                  {analytics.transactionCount}
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 rounded-2xl p-4 border border-zinc-200 dark:border-zinc-700">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">หมวดหมู่</p>
                <p className="text-2xl font-bold mt-1 text-zinc-900 dark:text-white">
                  {data.tag_breakdown?.length || 0}
                </p>
              </div>
            </div>
          )}

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Daily Trend Chart */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  แนวโน้มรายรับ-รายจ่าย
                </h2>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    <span className="text-zinc-500 dark:text-zinc-400">รายรับ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                    <span className="text-zinc-500 dark:text-zinc-400">รายจ่าย</span>
                  </div>
                </div>
              </div>
              
              <div className="h-64">
                {data.daily_trend && data.daily_trend.length > 0 ? (
                  <TrendChart data={data.daily_trend} formatCurrency={formatCurrency} />
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p>ไม่มีข้อมูลในช่วงนี้</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tag Breakdown Pie Chart */}
            <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-6">
                สัดส่วนรายจ่ายตามหมวดหมู่
              </h2>
              
              {data.tag_breakdown && data.tag_breakdown.length > 0 ? (
                <div className="flex items-start gap-6">
                  <div className="w-40 h-40 shrink-0">
                    <DonutChart data={data.tag_breakdown} />
                  </div>
                  <div className="flex-1 space-y-3 max-h-40 overflow-y-auto">
                    {data.tag_breakdown.slice(0, 6).map((tag, index) => {
                      const total = data.tag_breakdown?.reduce((sum, t) => sum + t.amount, 0) || 1;
                      const percentage = (tag.amount / total * 100).toFixed(1);
                      return (
                        <div key={tag.tag_id || 'null'} className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          ></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                              {tag.tag_name}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {tag.count} รายการ
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                              ฿{formatCompactCurrency(tag.amount)}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {percentage}%
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                  <div className="text-center">
                    <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                    </svg>
                    <p>ไม่มีข้อมูลในช่วงนี้</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                รายการล่าสุด
              </h2>
              <Link 
                href="/slip" 
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                ดูทั้งหมด →
              </Link>
            </div>
            
            {data.recent_slips && data.recent_slips.length > 0 ? (
              <div className="space-y-3">
                {data.recent_slips.map((slip) => (
                  <TransactionItem key={slip.id} slip={slip} formatCurrency={formatCurrency} />
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-400 dark:text-zinc-500">
                <p>ไม่มีรายการในช่วงนี้</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white mb-4">
              การดำเนินการด่วน
            </h2>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/slip/upload"
                className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-medium"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                อัพโหลดสลิป
              </Link>
              <Link
                href="/slip"
                className="flex items-center gap-2 px-5 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition font-medium"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                จัดการสลิป
              </Link>
              <Link
                href="/tag"
                className="flex items-center gap-2 px-5 py-3 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition font-medium"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
                </svg>
                จัดการหมวดหมู่
              </Link>
            </div>
          </div>

          {/* Leaderboard Section */}
          {leaderboard && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Users */}
              <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">🏆</span>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    Top Users
                  </h2>
                </div>
                
                {/* My Rank Badge */}
                {leaderboard.my_rank && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">คุณอยู่อันดับที่</span>
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{leaderboard.my_rank}</span>
                      </div>
                      <span className="text-sm text-blue-600 dark:text-blue-400">{leaderboard.my_slip_count} รายการ</span>
                    </div>
                  </div>
                )}
                
                {leaderboard.top_users && leaderboard.top_users.length > 0 ? (
                  <div className="space-y-3">
                    {leaderboard.top_users.map((user, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center gap-3 p-3 rounded-xl transition ${
                          user.is_me 
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' 
                            : 'bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          user.rank === 1 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400' :
                          user.rank === 2 ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-600 dark:text-zinc-300' :
                          user.rank === 3 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400' :
                          'bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400'
                        }`}>
                          {user.rank === 1 ? '🥇' : user.rank === 2 ? '🥈' : user.rank === 3 ? '🥉' : user.rank}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${user.is_me ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-900 dark:text-white'}`}>
                            {user.display_name} {user.is_me && <span className="text-xs">(คุณ)</span>}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.slip_count} รายการ</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            ฿{formatCompactCurrency(user.total_amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                    
                    {/* Show current user if not in top 3 */}
                    {leaderboard.my_user_data && (
                      <>
                        <div className="flex items-center gap-2 py-1">
                          <div className="flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-600"></div>
                          <span className="text-xs text-zinc-400">...</span>
                          <div className="flex-1 border-t border-dashed border-zinc-300 dark:border-zinc-600"></div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-sm font-bold text-blue-600 dark:text-blue-400">
                            {leaderboard.my_user_data.rank}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate text-blue-700 dark:text-blue-300">
                              {leaderboard.my_user_data.display_name} <span className="text-xs">(คุณ)</span>
                            </p>
                            <p className="text-xs text-blue-500 dark:text-blue-400">อันดับที่ {leaderboard.my_user_data.rank} • {leaderboard.my_user_data.slip_count} รายการ</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-blue-700 dark:text-blue-300">
                              ฿{formatCompactCurrency(leaderboard.my_user_data.total_amount)}
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="py-6 text-center text-zinc-400 dark:text-zinc-500">
                    <p>ยังไม่มีข้อมูล</p>
                  </div>
                )}
              </div>

              {/* Recent Active Users */}
              <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xl">⚡</span>
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                    Active ล่าสุด (30 วัน)
                  </h2>
                </div>
                
                {leaderboard.recent_active && leaderboard.recent_active.length > 0 ? (
                  <div className="space-y-3">
                    {leaderboard.recent_active.map((user, index) => (
                      <div 
                        key={index} 
                        className={`flex items-center gap-3 p-3 rounded-xl transition ${
                          user.is_me 
                            ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700' 
                            : 'bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">
                            {user.display_name[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium truncate ${user.is_me ? 'text-blue-700 dark:text-blue-300' : 'text-zinc-900 dark:text-white'}`}>
                            {user.display_name} {user.is_me && <span className="text-xs">(คุณ)</span>}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.slip_count} รายการล่าสุด</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-zinc-900 dark:text-white">
                            ฿{formatCompactCurrency(user.total_amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-zinc-400 dark:text-zinc-500">
                    <p>ยังไม่มีข้อมูล</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

// Trend Chart Component
function TrendChart({ data, formatCurrency }: { data: DailyTrend[]; formatCurrency: (n: number) => string }) {
  const maxValue = Math.max(...data.map(d => Math.max(d.income, d.expense))) || 1;
  // Calculate minimum width based on number of data points
  const minWidth = Math.max(data.length * 24, 100);
  
  return (
    <div className="h-full flex flex-col overflow-x-auto">
      <div className="flex-1 flex items-end gap-1 px-2" style={{ minWidth: `${minWidth}px` }}>
        {data.map((day) => {
          const incomeHeight = (day.income / maxValue) * 100;
          const expenseHeight = (day.expense / maxValue) * 100;
          
          return (
            <div 
              key={day.date} 
              className="flex-1 flex gap-0.5 items-end group relative" 
              style={{ minWidth: '20px' }}
            >
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none shadow-lg">
                <p className="font-medium mb-1">
                  {new Date(day.date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                </p>
                <p className="text-emerald-400">รับ: ฿{formatCurrency(day.income)}</p>
                <p className="text-rose-400">จ่าย: ฿{formatCurrency(day.expense)}</p>
              </div>
              
              {/* Income bar */}
              <div 
                className="flex-1 bg-emerald-400 dark:bg-emerald-500 rounded-t transition-all duration-300 hover:bg-emerald-500 dark:hover:bg-emerald-400"
                style={{ 
                  height: `${Math.max(incomeHeight, day.income > 0 ? 4 : 0)}%`,
                }}
              ></div>
              
              {/* Expense bar */}
              <div 
                className="flex-1 bg-rose-400 dark:bg-rose-500 rounded-t transition-all duration-300 hover:bg-rose-500 dark:hover:bg-rose-400"
                style={{ 
                  height: `${Math.max(expenseHeight, day.expense > 0 ? 4 : 0)}%`,
                }}
              ></div>
            </div>
          );
        })}
      </div>
      
      {/* X-axis labels */}
      <div className="flex gap-1 mt-3 px-2 border-t border-zinc-200 dark:border-zinc-700 pt-2" style={{ minWidth: `${minWidth}px` }}>
        {data.map((day) => (
          <div key={day.date} className="flex-1 text-center" style={{ minWidth: '20px' }}>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {new Date(day.date).getDate()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Donut Chart Component
function DonutChart({ data }: { data: TagBreakdown[] }) {
  const total = data.reduce((sum, t) => sum + t.amount, 0) || 1;
  let currentAngle = 0;
  
  const segments = data.slice(0, 6).map((tag, index) => {
    const percentage = tag.amount / total;
    const startAngle = currentAngle;
    const endAngle = currentAngle + percentage * 360;
    currentAngle = endAngle;
    
    return {
      ...tag,
      startAngle,
      endAngle,
      color: COLORS[index % COLORS.length],
    };
  });
  
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
      {segments.map((segment, index) => {
        const startRad = (segment.startAngle * Math.PI) / 180;
        const endRad = (segment.endAngle * Math.PI) / 180;
        const x1 = 50 + 40 * Math.cos(startRad);
        const y1 = 50 + 40 * Math.sin(startRad);
        const x2 = 50 + 40 * Math.cos(endRad);
        const y2 = 50 + 40 * Math.sin(endRad);
        const largeArc = segment.endAngle - segment.startAngle > 180 ? 1 : 0;
        
        return (
          <path
            key={index}
            d={`M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={segment.color}
            className="transition-all duration-300 hover:opacity-80"
          />
        );
      })}
      <circle cx="50" cy="50" r="24" className="fill-white dark:fill-zinc-800" />
    </svg>
  );
}

// Transaction Item Component
function TransactionItem({ slip, formatCurrency }: { slip: RecentSlip; formatCurrency: (n: number) => string }) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition">
      <div className={`p-2.5 rounded-xl shrink-0 ${
        slip.type === 'income' 
          ? 'bg-emerald-100 dark:bg-emerald-900/30' 
          : 'bg-rose-100 dark:bg-rose-900/30'
      }`}>
        {slip.type === 'income' ? (
          <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
          </svg>
        ) : (
          <svg className="w-5 h-5 text-rose-600 dark:text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
          </svg>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-zinc-900 dark:text-white truncate">
          {slip.account_name}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate">
          {slip.date} {slip.tag_name && `• ${slip.tag_name}`}
        </p>
      </div>
      
      <p className={`font-bold whitespace-nowrap ${
        slip.type === 'income' 
          ? 'text-emerald-600 dark:text-emerald-400' 
          : 'text-rose-600 dark:text-rose-400'
      }`}>
        {slip.type === 'income' ? '+' : '-'}฿{formatCurrency(slip.amount)}
      </p>
    </div>
  );
}
