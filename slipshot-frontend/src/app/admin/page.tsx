"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS, API_BASE_URL, formatThaiDate, THAILAND_TIMEZONE } from "@/lib/config";
import { useModal } from "@/context/ModalContext";
import type { User } from "@/lib/types";

interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_staff: boolean;
  is_active: boolean;
  date_joined: string;
  last_login: string | null;
  slip_count?: number;
}

interface UsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

interface TrendData {
  date: string;
  count: number;
  income?: number;
  expense?: number;
}

interface TopUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  slip_count: number;
  total_amount: number;
}

interface RecentUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  date_joined: string;
  is_active: boolean;
  is_staff: boolean;
}

interface AdminStats {
  total_users: number;
  total_slips: number;
  total_tags: number;
  new_users: number;
  active_users: number;
  slips_count: number;
  income: number;
  expense: number;
  net: number;
  avg_slip: number;
  new_users_change: number;
  active_users_change: number;
  slips_change: number;
  income_change: number;
  expense_change: number;
  user_trend: TrendData[];
  slip_trend: TrendData[];
  top_users: TopUser[];
  recent_users: RecentUser[];
  period: string;
}

type Period = 'today' | 'week' | 'month' | 'year' | 'all';
type SortField = 'date_joined' | 'last_login' | 'username' | 'slip_count' | 'email';
type SortOrder = 'asc' | 'desc';

const periodLabels: Record<Period, string> = {
  today: 'วันนี้',
  week: '7 วัน',
  month: '30 วัน',
  year: 'ปีนี้',
  all: 'ทั้งหมด'
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
  const [period, setPeriod] = useState<Period>('today');
  
  // Search, Sort state (client-side)
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>('date_joined');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Multi-select
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  
  const router = useRouter();
  const { showAlert, showConfirm } = useModal();

  const checkAdmin = useCallback(async () => {
    try {
      const res = await api.get<User>(API_ENDPOINTS.USER_PROFILE);
      if (res.ok && res.data) {
        if (!res.data.is_staff) {
          router.push("/dashboard");
          return;
        }
        setUser(res.data);
      } else {
        router.push("/auth/login");
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.push("/auth/login");
      }
    }
  }, [router]);

  const fetchStats = useCallback(async (selectedPeriod: Period = period) => {
    setStatsLoading(true);
    try {
      const res = await api.get<AdminStats>(`${API_BASE_URL}/api/admin/stats/?period=${selectedPeriod}`);
      console.log('Admin stats response:', res);
      if (res.ok && res.data) {
        setStats(res.data);
      } else {
        console.error('Failed to fetch stats:', res.error, res.status);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [period]);

  const fetchAllUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const res = await api.get<UsersResponse>(`${API_BASE_URL}/api/admin/users/?page_size=1000`);
      if (res.ok && res.data) {
        setAllUsers(res.data.users);
      }
    } catch {
      setError("ไม่สามารถโหลดข้อมูลผู้ใช้ได้");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await checkAdmin();
      await Promise.all([fetchStats(), fetchAllUsers()]);
      setLoading(false);
    };
    init();
  }, [checkAdmin, fetchStats, fetchAllUsers]);

  const handlePeriodChange = (newPeriod: Period) => {
    setPeriod(newPeriod);
    fetchStats(newPeriod);
  };

  // Client-side filtering, sorting, and pagination
  const processedUsers = useMemo(() => {
    let result = [...allUsers];
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u => 
        u.username.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.first_name?.toLowerCase().includes(q) ||
        u.last_name?.toLowerCase().includes(q)
      );
    }
    
    result.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;
      
      switch (sortField) {
        case 'username':
          aVal = a.username.toLowerCase();
          bVal = b.username.toLowerCase();
          break;
        case 'email':
          aVal = (a.email || '').toLowerCase();
          bVal = (b.email || '').toLowerCase();
          break;
        case 'date_joined':
          aVal = new Date(a.date_joined).getTime();
          bVal = new Date(b.date_joined).getTime();
          break;
        case 'last_login':
          aVal = a.last_login ? new Date(a.last_login).getTime() : 0;
          bVal = b.last_login ? new Date(b.last_login).getTime() : 0;
          break;
        case 'slip_count':
          aVal = a.slip_count || 0;
          bVal = b.slip_count || 0;
          break;
      }
      
      if (aVal === null || bVal === null) return 0;
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [allUsers, searchQuery, sortField, sortOrder]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedUsers.slice(start, start + pageSize);
  }, [processedUsers, currentPage, pageSize]);

  const paginationInfo = useMemo(() => ({
    total_count: processedUsers.length,
    total_pages: Math.ceil(processedUsers.length / pageSize),
    has_next: currentPage < Math.ceil(processedUsers.length / pageSize),
    has_prev: currentPage > 1,
  }), [processedUsers.length, pageSize, currentPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedUsers(new Set());
  };

  const toggleSelectUser = (userId: number) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === paginatedUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(paginatedUsers.map(u => u.id)));
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    if (userId === user?.id) {
      showAlert("error", "ไม่สามารถดำเนินการได้", "ไม่สามารถระงับบัญชีตัวเองได้");
      return;
    }
    
    try {
      const res = await api.post(`${API_BASE_URL}/api/admin/users/${userId}/toggle-status/`, {
        is_active: !currentStatus
      });
      if (res.ok) {
        setAllUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, is_active: !currentStatus } : u
        ));
      }
    } catch {
      setError("ไม่สามารถเปลี่ยนสถานะได้");
    }
  };

  const toggleAdminStatus = async (userId: number, currentStatus: boolean) => {
    if (userId === user?.id) {
      showAlert("error", "ไม่สามารถดำเนินการได้", "ไม่สามารถลบสิทธิ์แอดมินของตัวเองได้");
      return;
    }
    
    const adminCount = allUsers.filter(u => u.is_staff).length;
    if (currentStatus && adminCount <= 1) {
      showAlert("error", "ไม่สามารถดำเนินการได้", "ต้องมีแอดมินอย่างน้อย 1 คนในระบบ");
      return;
    }
    
    try {
      const res = await api.post(`${API_BASE_URL}/api/admin/users/${userId}/toggle-admin/`, {
        is_staff: !currentStatus
      });
      if (res.ok) {
        setAllUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, is_staff: !currentStatus } : u
        ));
      }
    } catch {
      setError("ไม่สามารถเปลี่ยนสถานะได้");
    }
  };

  const deleteUser = async (userId: number) => {
    const targetUser = allUsers.find(u => u.id === userId);
    if (!targetUser) return;
    
    if (userId === user?.id) {
      showAlert("error", "ไม่สามารถดำเนินการได้", "ไม่สามารถลบบัญชีตัวเองได้");
      return;
    }
    
    const confirmed = await showConfirm(
      "warning",
      "ยืนยันการลบ",
      `ต้องการลบผู้ใช้ "${targetUser.username}" หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`
    );
    
    if (!confirmed) return;
    
    try {
      const res = await api.delete(`${API_BASE_URL}/api/admin/users/${userId}/delete/`);
      if (res.ok) {
        setAllUsers(prev => prev.filter(u => u.id !== userId));
        showAlert("success", "สำเร็จ", "ลบผู้ใช้เรียบร้อยแล้ว");
        fetchStats();
      } else {
        showAlert("error", "เกิดข้อผิดพลาด", res.error || "ไม่สามารถลบผู้ใช้ได้");
      }
    } catch {
      showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถลบผู้ใช้ได้");
    }
  };

  const bulkDeleteUsers = async () => {
    if (selectedUsers.size === 0) return;
    
    const idsToDelete = Array.from(selectedUsers).filter(id => id !== user?.id);
    if (idsToDelete.length === 0) {
      showAlert("error", "ไม่สามารถดำเนินการได้", "ไม่สามารถลบบัญชีตัวเองได้");
      return;
    }
    
    const confirmed = await showConfirm(
      "warning",
      "ยืนยันการลบ",
      `ต้องการลบผู้ใช้ ${idsToDelete.length} คน หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้`
    );
    
    if (!confirmed) return;
    
    try {
      const res = await api.post(`${API_BASE_URL}/api/admin/users/bulk-delete/`, {
        user_ids: idsToDelete
      });
      if (res.ok) {
        setAllUsers(prev => prev.filter(u => !idsToDelete.includes(u.id)));
        setSelectedUsers(new Set());
        showAlert("success", "สำเร็จ", `ลบผู้ใช้ ${idsToDelete.length} คนเรียบร้อยแล้ว`);
        fetchStats();
      } else {
        showAlert("error", "เกิดข้อผิดพลาด", res.error || "ไม่สามารถลบผู้ใช้ได้");
      }
    } catch {
      showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถลบผู้ใช้ได้");
    }
  };

  const formatCurrency = (n: number) => {
    return n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return sortOrder === 'asc' ? (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-48"></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-zinc-200 dark:bg-zinc-700 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user?.is_staff) {
    return null;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">Admin Dashboard</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">จัดการระบบและผู้ใช้งาน</p>
        </div>
        
        {/* Period Selector */}
        {activeTab === 'overview' && (
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
            {(Object.keys(periodLabels) as Period[]).map(p => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  period === p
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'overview'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          ภาพรวม
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === 'users'
              ? 'bg-blue-600 text-white'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
          }`}
        >
          จัดการผู้ใช้
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className={statsLoading ? 'opacity-60 pointer-events-none' : ''}>
          {/* Main Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCardWithChange 
              title="ผู้ใช้ทั้งหมด" 
              value={stats?.total_users || 0} 
              change={null}
              icon={<UsersIcon />} 
              color="blue" 
            />
            <StatCardWithChange 
              title="สลิปทั้งหมด" 
              value={stats?.total_slips || 0} 
              change={null}
              icon={<DocumentIcon />} 
              color="green" 
            />
            <StatCardWithChange 
              title={`ผู้ใช้ใหม่ (${periodLabels[period]})`}
              value={stats?.new_users || 0} 
              change={stats?.new_users_change || null}
              icon={<UserPlusIcon />} 
              color="violet" 
            />
            <StatCardWithChange 
              title={`ใช้งาน (${periodLabels[period]})`}
              value={stats?.active_users || 0} 
              change={stats?.active_users_change || null}
              icon={<ChartIcon />} 
              color="amber" 
            />
          </div>

          {/* Financial Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <FinanceCard 
              title={`รายรับ (${periodLabels[period]})`}
              value={stats?.income || 0} 
              change={stats?.income_change || null}
              type="income"
            />
            <FinanceCard 
              title={`รายจ่าย (${periodLabels[period]})`}
              value={stats?.expense || 0} 
              change={stats?.expense_change || null}
              type="expense"
            />
            <FinanceCard 
              title={`ยอดสุทธิ (${periodLabels[period]})`}
              value={stats?.net || 0} 
              change={null}
              type="net"
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* User Trend Chart */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <TrendUpIcon className="w-5 h-5 text-blue-500" />
                แนวโน้มผู้ใช้ใหม่
              </h3>
              <MiniBarChart 
                data={stats?.user_trend || []} 
                dataKey="count" 
                color="blue"
                emptyText="ไม่มีข้อมูลผู้ใช้ใหม่"
              />
            </div>

            {/* Slip Trend Chart */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <BarChartIcon className="w-5 h-5 text-green-500" />
                แนวโน้มสลิป
              </h3>
              <MiniBarChart 
                data={stats?.slip_trend || []} 
                dataKey="count" 
                color="green"
                emptyText="ไม่มีข้อมูลสลิป"
              />
            </div>
          </div>

          {/* Additional Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MiniStatCard title="หมวดหมู่ทั้งหมด" value={stats?.total_tags || 0} icon={<TagIcon className="w-5 h-5 text-violet-500" />} />
            <MiniStatCard title={`สลิป (${periodLabels[period]})`} value={stats?.slips_count || 0} icon={<DocumentIcon className="w-5 h-5 text-blue-500" />} />
            <MiniStatCard title="เฉลี่ย/สลิป" value={`฿${formatCurrency(stats?.avg_slip || 0)}`} icon={<CurrencyIcon className="w-5 h-5 text-emerald-500" />} />
            <MiniStatCard 
              title="% การเปลี่ยนแปลงสลิป" 
              value={stats?.slips_change !== undefined ? `${stats.slips_change > 0 ? '+' : ''}${stats.slips_change}%` : '-'} 
              icon={stats?.slips_change !== undefined && stats.slips_change >= 0 ? <TrendUpIcon className="w-5 h-5 text-green-500" /> : <TrendDownIcon className="w-5 h-5 text-red-500" />} 
            />
          </div>

          {/* Top Users and Recent Users */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Users */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <TrophyIcon className="w-5 h-5 text-yellow-500" />
                ผู้ใช้ยอดนิยม (รายการมากที่สุด)
              </h3>
              {stats?.top_users && stats.top_users.length > 0 ? (
                <div className="space-y-3">
                  {stats.top_users.map((u, i) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-zinc-200 text-zinc-600' :
                        i === 2 ? 'bg-amber-100 text-amber-700' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}
                        </p>
                        <p className="text-xs text-zinc-500">@{u.username}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{u.slip_count} รายการ</p>
                        <p className="text-xs text-zinc-500">฿{formatCurrency(u.total_amount || 0)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400 text-center py-4">ยังไม่มีข้อมูล</p>
              )}
            </div>

            {/* Recent Users */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-blue-500" />
                ผู้ใช้ล่าสุด
              </h3>
              {stats?.recent_users && stats.recent_users.length > 0 ? (
                <div className="space-y-3">
                  {stats.recent_users.map((u) => (
                      <div key={u.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                          <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">
                            {u.first_name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}
                          </p>
                          <p className="text-xs text-zinc-500">@{u.username}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-zinc-600 dark:text-zinc-400">
                            {(() => {
                              const [date, time] = u.date_joined.split(' ');
                              return `${formatThaiDate(date)} ${time || ''}`;
                            })()}
                          </p>
                          <div className="flex gap-1 justify-end mt-1">
                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                              u.is_active 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {u.is_staff && (
                              <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                                Admin
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400 text-center py-4">ยังไม่มีผู้ใช้</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-6 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <BoltIcon className="w-5 h-5 text-amber-500" />
              การดำเนินการด่วน
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button onClick={() => setShowAddModal(true)} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-center group">
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:scale-110 transition">
                  <UserPlusIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">เพิ่มผู้ใช้ใหม่</span>
              </button>
              <button onClick={() => setActiveTab('users')} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-center group">
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:scale-110 transition">
                  <UsersIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">ดูรายชื่อผู้ใช้</span>
              </button>
              <button onClick={() => fetchStats(period)} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-center group">
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center group-hover:scale-110 transition">
                  <RefreshIcon className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">รีเฟรชข้อมูล</span>
              </button>
              <a href="/dashboard" className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition text-center group">
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center group-hover:scale-110 transition">
                  <HomeIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">ไปยัง Dashboard</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex flex-col gap-4 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">รายชื่อผู้ใช้</h2>
                <span className="text-sm text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">{processedUsers.length} คน</span>
              </div>
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                เพิ่มผู้ใช้
              </button>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="relative w-full sm:w-64">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input type="text" value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="ค้นหาผู้ใช้..." className="w-full pl-9 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-zinc-100" />
              </div>
              
              {selectedUsers.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">เลือก {selectedUsers.size} รายการ</span>
                  <button onClick={bulkDeleteUsers} className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    ลบที่เลือก
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
                  <th className="pb-3 font-medium w-10">
                    <input type="checkbox" title="เลือกทั้งหมด" checked={selectedUsers.size === paginatedUsers.length && paginatedUsers.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500" />
                  </th>
                  <th className="pb-3 font-medium"><button onClick={() => handleSort('username')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300">ผู้ใช้ <SortIcon field="username" /></button></th>
                  <th className="pb-3 font-medium hidden md:table-cell"><button onClick={() => handleSort('email')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300">Email <SortIcon field="email" /></button></th>
                  <th className="pb-3 font-medium"><button onClick={() => handleSort('date_joined')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300">วันที่สมัคร <SortIcon field="date_joined" /></button></th>
                  <th className="pb-3 font-medium hidden sm:table-cell"><button onClick={() => handleSort('last_login')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300">Login ล่าสุด <SortIcon field="last_login" /></button></th>
                  <th className="pb-3 font-medium hidden lg:table-cell"><button onClick={() => handleSort('slip_count')} className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-300">Slips <SortIcon field="slip_count" /></button></th>
                  <th className="pb-3 font-medium">สถานะ</th>
                  <th className="pb-3 font-medium">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {usersLoading ? (
                  <tr><td colSpan={8} className="py-8 text-center text-zinc-500"><div className="flex items-center justify-center gap-2"><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>กำลังโหลด...</div></td></tr>
                ) : paginatedUsers.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-zinc-500">{searchQuery ? `ไม่พบผู้ใช้ที่ค้นหา "${searchQuery}"` : 'ไม่มีผู้ใช้'}</td></tr>
                ) : (
                  paginatedUsers.map(u => (
                    <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="py-3"><input type="checkbox" title="เลือกผู้ใช้นี้" checked={selectedUsers.has(u.id)} onChange={() => toggleSelectUser(u.id)} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500" /></td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                            <span className="text-blue-600 dark:text-blue-400 font-medium text-sm">{u.first_name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase() || 'U'}</span>
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : u.username}</p>
                            <p className="text-xs text-zinc-500 truncate">@{u.username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-400 hidden md:table-cell">{u.email || '-'}</td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-400">{formatThaiDate(u.date_joined)}</td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-400 hidden sm:table-cell">{u.last_login ? formatThaiDate(u.last_login) : '-'}</td>
                      <td className="py-3 text-zinc-600 dark:text-zinc-400 hidden lg:table-cell">{u.slip_count ?? 0}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                          {u.is_staff && <span className="px-2 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">Admin</span>}
                        </div>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingUser(u); setShowEditModal(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="แก้ไข">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={() => toggleUserStatus(u.id, u.is_active)} className={`p-1.5 rounded ${u.is_active ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20' : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`} title={u.is_active ? 'ระงับ' : 'เปิดใช้งาน'}>
                            {u.is_active ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg> : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                          </button>
                          {u.id !== user?.id && (
                            <>
                              <button onClick={() => toggleAdminStatus(u.id, u.is_staff)} className={`p-1.5 rounded ${u.is_staff ? 'text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`} title={u.is_staff ? 'ลบสิทธิ์ Admin' : 'ให้สิทธิ์ Admin'}>
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                              </button>
                              <button onClick={() => deleteUser(u.id)} className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="ลบ">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {paginationInfo.total_pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-4 border-t border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <label htmlFor="pageSize">แสดง</label>
                <select id="pageSize" title="จำนวนรายการต่อหน้า" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded text-sm">
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>รายการ จากทั้งหมด {paginationInfo.total_count} รายการ</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button onClick={() => handlePageChange(currentPage - 1)} disabled={!paginationInfo.has_prev} className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed">ก่อนหน้า</button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, paginationInfo.total_pages) }, (_, i) => {
                    let pageNum: number;
                    if (paginationInfo.total_pages <= 5) pageNum = i + 1;
                    else if (currentPage <= 3) pageNum = i + 1;
                    else if (currentPage >= paginationInfo.total_pages - 2) pageNum = paginationInfo.total_pages - 4 + i;
                    else pageNum = currentPage - 2 + i;
                    return (
                      <button key={pageNum} onClick={() => handlePageChange(pageNum)} className={`w-8 h-8 text-sm rounded ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700'}`}>{pageNum}</button>
                    );
                  })}
                </div>
                <button onClick={() => handlePageChange(currentPage + 1)} disabled={!paginationInfo.has_next} className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed">ถัดไป</button>
              </div>
            </div>
          )}
        </div>
      )}

      {showAddModal && <AddUserModal onClose={() => setShowAddModal(false)} onSuccess={(newUser) => { setAllUsers(prev => [...prev, newUser]); setShowAddModal(false); fetchStats(); }} />}
      {showEditModal && editingUser && <EditUserModal user={editingUser} onClose={() => { setShowEditModal(false); setEditingUser(null); }} onSuccess={(updatedUser) => { setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? { ...u, ...updatedUser } : u)); setShowEditModal(false); setEditingUser(null); }} />}
    </div>
  );
}

// Components

function AddUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (user: AdminUser) => void; }) {
  const [form, setForm] = useState({ username: '', email: '', password: '', first_name: '', last_name: '', is_staff: false });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username || !form.password) { setError('กรุณากรอก Username และ Password'); return; }
    if (form.password.length < 6) { setError('Password ต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; user: AdminUser; error?: string }>(`${API_BASE_URL}/api/admin/users/create/`, form);
      if (res.ok && res.data?.user) onSuccess(res.data.user);
      else setError(res.error || res.data?.error || 'ไม่สามารถสร้างผู้ใช้ได้');
    } catch { setError('เกิดข้อผิดพลาด'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">เพิ่มผู้ใช้ใหม่</h2>
            <button onClick={onClose} title="ปิด" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username <span className="text-red-500">*</span></label><input type="text" title="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
            <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label><input type="email" title="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Password <span className="text-red-500">*</span></label><input type="password" title="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required minLength={6} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">ชื่อ</label><input type="text" title="ชื่อ" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">นามสกุล</label><input type="text" title="นามสกุล" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="is_staff" checked={form.is_staff} onChange={(e) => setForm({ ...form, is_staff: e.target.checked })} className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500" /><label htmlFor="is_staff" className="text-sm text-zinc-700 dark:text-zinc-300">ให้สิทธิ์ Admin</label></div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700">ยกเลิก</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'กำลังสร้าง...' : 'สร้างผู้ใช้'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function EditUserModal({ user, onClose, onSuccess }: { user: AdminUser; onClose: () => void; onSuccess: (user: AdminUser) => void; }) {
  const [form, setForm] = useState({ username: user.username, email: user.email || '', first_name: user.first_name || '', last_name: user.last_name || '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.username) { setError('กรุณากรอก Username'); return; }
    
    setLoading(true);
    try {
      const res = await api.put<{ success: boolean; user: AdminUser; error?: string }>(`${API_BASE_URL}/api/admin/users/${user.id}/`, form);
      if (res.ok && res.data?.user) onSuccess(res.data.user);
      else setError(res.error || res.data?.error || 'ไม่สามารถอัพเดทผู้ใช้ได้');
    } catch { setError('เกิดข้อผิดพลาด'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">แก้ไขผู้ใช้</h2>
            <button onClick={onClose} title="ปิด" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"><svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
          {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Username <span className="text-red-500">*</span></label><input type="text" title="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" required /></div>
            <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email</label><input type="email" title="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">ชื่อ</label><input type="text" title="ชื่อ" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
              <div><label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">นามสกุล</label><input type="text" title="นามสกุล" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700">ยกเลิก</button>
              <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'กำลังบันทึก...' : 'บันทึก'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function StatCardWithChange({ title, value, change, icon, color }: { 
  title: string; 
  value: string | number; 
  change: number | null;
  icon: React.ReactNode; 
  color: 'blue' | 'green' | 'violet' | 'amber'; 
}) {
  const colorClasses = { 
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400', 
    green: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400', 
    violet: 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400', 
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' 
  };
  
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {change !== null && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            change >= 0 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-3">{value}</p>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{title}</p>
    </div>
  );
}

function FinanceCard({ title, value, change, type }: { 
  title: string; 
  value: number; 
  change: number | null;
  type: 'income' | 'expense' | 'net';
}) {
  const formatCurrency = (n: number) => n.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  
  const typeConfig = {
    income: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', iconColor: 'text-emerald-500' },
    expense: { color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-900/20', iconColor: 'text-rose-500' },
    net: { 
      color: value >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400', 
      bg: value >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-rose-50 dark:bg-rose-900/20',
      iconColor: value >= 0 ? 'text-blue-500' : 'text-rose-500'
    },
  };
  
  const config = typeConfig[type];
  const IconComponent = type === 'income' ? IncomeIcon : type === 'expense' ? ExpenseIcon : (value >= 0 ? TrendUpIcon : TrendDownIcon);
  
  return (
    <div className={`rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-5 ${config.bg}`}>
      <div className="flex items-center justify-between mb-2">
        <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
        {change !== null && (
          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
            change >= 0 
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>
            {change >= 0 ? '↑' : '↓'} {Math.abs(change)}%
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold ${config.color}`}>
        {type === 'net' && value >= 0 ? '+' : ''}฿{formatCurrency(value)}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{title}</p>
    </div>
  );
}

function MiniStatCard({ title, value, icon }: { title: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{title}</p>
      </div>
      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}

function MiniBarChart({ data, dataKey, color, emptyText }: { 
  data: TrendData[]; 
  dataKey: keyof TrendData;
  color: 'blue' | 'green';
  emptyText: string;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
        {emptyText}
      </div>
    );
  }
  
  const values = data.map(d => Number(d[dataKey]) || 0);
  const maxValue = Math.max(...values, 1);
  
  const colorClass = color === 'blue' ? 'bg-blue-500' : 'bg-green-500';
  
  return (
    <div className="h-32">
      <div className="flex items-end justify-between h-24 gap-1">
        {data.map((d, i) => {
          const value = Number(d[dataKey]) || 0;
          const height = (value / maxValue) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div 
                className={`w-full ${colorClass} rounded-t transition-all hover:opacity-80`}
                style={{ height: `${Math.max(height, 4)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block bg-zinc-800 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                {formatThaiDate(d.date, { day: 'numeric', month: 'short' })}: {value}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-zinc-400">
        <span>{data[0] ? formatThaiDate(data[0].date, { day: 'numeric', month: 'short' }) : ''}</span>
        <span>{data[data.length - 1] ? formatThaiDate(data[data.length - 1].date, { day: 'numeric', month: 'short' }) : ''}</span>
      </div>
    </div>
  );
}

// Icons
function UsersIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" /></svg>; }
function DocumentIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }
function UserPlusIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>; }
function ChartIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>; }
function TagIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>; }
function CurrencyIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function TrendUpIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>; }
function TrendDownIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>; }
function BarChartIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>; }
function TrophyIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>; }
function ClockIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>; }
function BoltIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>; }
function RefreshIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>; }
function HomeIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>; }
function IncomeIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m0-16l-4 4m4-4l4 4" /></svg>; }
function ExpenseIcon({ className = "w-6 h-6" }: { className?: string }) { return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20V4m0 16l-4-4m4 4l4-4" /></svg>; }
