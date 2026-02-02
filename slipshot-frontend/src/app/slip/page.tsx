"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS, getSlipUrl, getThaiDate, getThaiTime } from "@/lib/config";
import { useModal } from "@/context/ModalContext";
import { useDataCache } from "@/context/DataCacheContext";
import { saveFormData, loadFormData, clearFormData } from "@/lib/formPersistence";
import type { Slip, SlipFormData } from "@/lib/types";

const FORM_ID = "slip_form";

const getInitialForm = (): SlipFormData => ({
  account_name: "",
  amount: "",
  date: getThaiDate(),
  time: getThaiTime(),
  tag_id: "",
  type: "expense",
  note: "",
});

type SortField = "date" | "amount" | "account_name" | "type";
type SortOrder = "asc" | "desc";

export default function SlipManager() {
  const [slips, setSlips] = useState<Slip[]>([]);
  const [form, setForm] = useState<SlipFormData>(getInitialForm());
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Table features
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 10;
  
  const { showAlert, showConfirm } = useModal();
  const { tags, fetchTags, invalidateSlips, invalidateDashboard } = useDataCache();
  
  // Use ref to track if initial fetch is done
  const initialFetchDoneRef = useRef(false);
  
  // Load saved form on mount
  useEffect(() => {
    const saved = loadFormData<SlipFormData>(FORM_ID);
    if (saved) {
      setForm(saved);
      setShowForm(true);
    }
  }, []);
  
  // Save form when it changes (debounced)
  useEffect(() => {
    if (showForm && !editingId) {
      const hasData = form.account_name || form.amount;
      if (hasData) {
        saveFormData(FORM_ID, form);
      }
    }
  }, [form, showForm, editingId]);

  const fetchSlips = useCallback(async () => {
    try {
      const res = await api.get<Slip[]>(API_ENDPOINTS.SLIPS);
      if (res.ok && res.data) {
        setSlips(res.data);
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }
    }
  }, []);

  useEffect(() => {
    // Prevent double fetch on strict mode
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    
    Promise.all([fetchSlips(), fetchTags()]).finally(() => setLoading(false));
  }, [fetchSlips, fetchTags]);

  // Set default tag when tags load
  useEffect(() => {
    if (tags.length > 0 && !form.tag_id && !editingId) {
      // Find "ไม่ระบุ" tag or use first tag
      const defaultTag = tags.find(t => t.name === "ไม่ระบุ") || tags[0];
      if (defaultTag) {
        setForm(prev => ({ ...prev, tag_id: defaultTag.id.toString() }));
      }
    }
  }, [tags, form.tag_id, editingId]);

  // Filtered and sorted slips
  const filteredSlips = useMemo(() => {
    let result = [...slips];
    
    // Search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(slip => 
        slip.account_name.toLowerCase().includes(searchLower) ||
        slip.date.includes(searchLower) ||
        (slip.note && slip.note.toLowerCase().includes(searchLower)) ||
        (slip.type === "income" ? "รายรับ" : "รายจ่าย").includes(searchLower)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      let compare = 0;
      switch (sortField) {
        case "date":
          compare = a.date.localeCompare(b.date);
          break;
        case "amount":
          compare = Number(a.amount) - Number(b.amount);
          break;
        case "account_name":
          compare = a.account_name.localeCompare(b.account_name);
          break;
        case "type":
          compare = a.type.localeCompare(b.type);
          break;
      }
      return sortOrder === "asc" ? compare : -compare;
    });
    
    return result;
  }, [slips, search, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredSlips.length / itemsPerPage);
  const paginatedSlips = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSlips.slice(start, start + itemsPerPage);
  }, [filteredSlips, currentPage]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const url = editingId ? getSlipUrl(editingId) : API_ENDPOINTS.SLIPS;
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await api.request(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_name: form.account_name,
          amount: form.amount,
          date: form.date,
          time: form.time || null,
          tag_id: form.tag_id,
          type: form.type,
          note: form.note || "",
        }),
      });

      if (!res.ok) {
        setError(res.error || "บันทึกไม่สำเร็จ");
        return;
      }

      showAlert("success", "สำเร็จ", editingId ? "อัพเดตรายการเรียบร้อย" : "เพิ่มรายการเรียบร้อย");
      clearFormData(FORM_ID); // Clear saved form after successful submit
      handleCancelEdit();
      invalidateSlips();
      invalidateDashboard();
      fetchSlips();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (slip: Slip) => {
    setForm({
      account_name: slip.account_name,
      amount: slip.amount.toString(),
      date: slip.date,
      time: slip.time || "",
      tag_id: slip.tag?.id?.toString() || "",
      type: slip.type,
      note: slip.note || "",
    });
    setEditingId(slip.id);
    setShowForm(true);
    setError("");
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm(
      "warning",
      "ยืนยันการลบ",
      "ต้องการลบรายการนี้หรือไม่? การลบจะไม่สามารถย้อนกลับได้",
      "ลบ",
      "ยกเลิก"
    );
    
    if (!confirmed) return;

    try {
      await api.delete(getSlipUrl(id));
      showAlert("success", "ลบสำเร็จ", "ลบรายการเรียบร้อยแล้ว");
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      invalidateSlips();
      invalidateDashboard();
      fetchSlips();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      } else {
        showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถลบรายการได้");
      }
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;
    
    const confirmed = await showConfirm(
      "warning",
      "ยืนยันการลบหลายรายการ",
      `ต้องการลบ ${selectedIds.size} รายการที่เลือกหรือไม่? การลบจะไม่สามารถย้อนกลับได้`,
      "ลบทั้งหมด",
      "ยกเลิก"
    );
    
    if (!confirmed) return;

    setDeleting(true);
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => api.delete(getSlipUrl(id)))
      );
      showAlert("success", "ลบสำเร็จ", `ลบ ${selectedIds.size} รายการเรียบร้อยแล้ว`);
      setSelectedIds(new Set());
      invalidateSlips();
      invalidateDashboard();
      fetchSlips();
    } catch (err) {
      showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถลบบางรายการได้");
    } finally {
      setDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    const initialForm = getInitialForm();
    setForm({
      ...initialForm,
      date: getThaiDate(),
      time: getThaiTime(),
      tag_id: tags.find(t => t.name === "ไม่ระบุ")?.id.toString() || tags[0]?.id.toString() || "",
      note: "",
    });
    setEditingId(null);
    setShowForm(false);
    setError("");
    clearFormData(FORM_ID); // Clear saved form when canceling
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedSlips.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedSlips.map(s => s.id)));
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return new Intl.NumberFormat("th-TH", {
      style: "decimal",
      minimumFractionDigits: 2,
    }).format(num);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    }
    return sortOrder === "asc" 
      ? <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
      : <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">จัดการสลิป</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">
            ทั้งหมด {slips.length} รายการ
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            เพิ่มรายการ
          </button>
          <Link
            href="/slip/upload"
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            อัพโหลดสลิป
          </Link>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {editingId ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}
            </h2>
            <button
              onClick={handleCancelEdit}
              title="ปิด"
              className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  ชื่อบัญชี/รายการ
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="เช่น ค่าอาหาร, เงินเดือน"
                  value={form.account_name}
                  onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  จำนวนเงิน
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="0.00"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  วันที่
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  type="date"
                  title="เลือกวันที่"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  เวลา
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  type="time"
                  title="เลือกเวลา"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  ประเภท
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  title="เลือกประเภท"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as 'income' | 'expense' })}
                  required
                  disabled={submitting}
                >
                  <option value="expense">รายจ่าย</option>
                  <option value="income">รายรับ</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  หมวดหมู่
                </label>
                <select
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  title="เลือกหมวดหมู่"
                  value={form.tag_id}
                  onChange={(e) => setForm({ ...form, tag_id: e.target.value })}
                  required
                  disabled={submitting}
                >
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  หมายเหตุ (ค้นหาได้)
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  placeholder="เพิ่มหมายเหตุ..."
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  disabled={submitting}
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting ? "กำลังบันทึก..." : editingId ? "อัพเดต" : "เพิ่มรายการ"}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                ยกเลิก
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative flex-1 sm:flex-none">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="ค้นหา..."
                  className="w-full sm:w-64 pl-10 pr-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            
            {/* Bulk actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  เลือก {selectedIds.size} รายการ
                </span>
                <button
                  onClick={handleDeleteSelected}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  {deleting ? "กำลังลบ..." : "ลบที่เลือก"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="p-8 text-center text-zinc-500">กำลังโหลด...</div>
        ) : filteredSlips.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            {search ? "ไม่พบรายการที่ค้นหา" : "ยังไม่มีรายการ"}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-800">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        title="เลือกทั้งหมด"
                        checked={selectedIds.size === paginatedSlips.length && paginatedSlips.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => handleSort("date")}
                    >
                      <div className="flex items-center gap-2">
                        วันที่
                        <SortIcon field="date" />
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => handleSort("account_name")}
                    >
                      <div className="flex items-center gap-2">
                        ชื่อรายการ
                        <SortIcon field="account_name" />
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => handleSort("type")}
                    >
                      <div className="flex items-center gap-2">
                        ประเภท
                        <SortIcon field="type" />
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right text-sm font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer hover:text-zinc-900 dark:hover:text-white"
                      onClick={() => handleSort("amount")}
                    >
                      <div className="flex items-center gap-2 justify-end">
                        จำนวนเงิน
                        <SortIcon field="amount" />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      หมวดหมู่
                    </th>
                    <th className="w-24 px-4 py-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {paginatedSlips.map((slip) => (
                    <tr 
                      key={slip.id} 
                      className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${
                        selectedIds.has(slip.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          title="เลือกรายการนี้"
                          checked={selectedIds.has(slip.id)}
                          onChange={() => toggleSelect(slip.id)}
                          className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        <div>{slip.date}</div>
                        {slip.time && <div className="text-xs text-zinc-400">{slip.time}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {slip.account_name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                          slip.type === "income"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                        }`}>
                          {slip.type === "income" ? "รายรับ" : "รายจ่าย"}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        slip.type === "income" 
                          ? "text-emerald-600 dark:text-emerald-400" 
                          : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {slip.type === "income" ? "+" : "-"}฿{formatCurrency(slip.amount)}
                      </td>
                      <td className="px-4 py-3">
                        {slip.tag && (
                          <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-xs text-zinc-600 dark:text-zinc-400">
                            {slip.tag.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleEdit(slip)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                            title="แก้ไข"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(slip.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                            title="ลบ"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  แสดง {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredSlips.length)} จาก {filteredSlips.length} รายการ
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ก่อนหน้า
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 text-sm rounded-lg transition ${
                            currentPage === pageNum
                              ? "bg-blue-600 text-white"
                              : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    ถัดไป
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
