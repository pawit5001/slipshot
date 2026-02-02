"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS, getTagUrl } from "@/lib/config";
import { useModal } from "@/context/ModalContext";
import { useDataCache } from "@/context/DataCacheContext";
import type { Tag } from "@/lib/types";

type SortField = "name" | "id";
type SortOrder = "asc" | "desc";

const ITEMS_PER_PAGE = 10;

export default function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { showAlert, showConfirm } = useModal();
  const { invalidateTags } = useDataCache();

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.get<Tag[]>(API_ENDPOINTS.TAGS);
      if (res.ok && res.data) setTags(res.data);
    } catch (err) {
      if (err instanceof SessionExpiredError) setError("Session expired");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const filteredTags = useMemo(() => {
    let result = [...tags];
    if (search.trim()) {
      const s = search.toLowerCase();
      result = result.filter(tag => tag.name.toLowerCase().includes(s));
    }
    result.sort((a, b) => {
      const aVal = sortField === "name" ? a.name.toLowerCase() : a.id;
      const bVal = sortField === "name" ? b.name.toLowerCase() : b.id;
      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [tags, search, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredTags.length / ITEMS_PER_PAGE);
  const paginatedTags = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredTags.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTags, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortOrder("asc"); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const url = editingId ? getTagUrl(editingId) : API_ENDPOINTS.TAGS;
    const method = editingId ? "PUT" : "POST";
    try {
      const res = await api.request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      if (!res.ok) { setError(res.error || "บันทึกไม่สำเร็จ"); return; }
      showAlert("success", "สำเร็จ", editingId ? "อัพเดตหมวดหมู่เรียบร้อย" : "เพิ่มหมวดหมู่เรียบร้อย");
      setName(""); setEditingId(null); setShowForm(false);
      invalidateTags(); fetchTags();
    } catch (err) {
      if (err instanceof SessionExpiredError) setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
    } finally { setSubmitting(false); }
  };

  const handleEdit = (tag: Tag) => { setName(tag.name); setEditingId(tag.id); setShowForm(true); setError(""); };

  const handleDelete = async (id: number) => {
    const tag = tags.find(t => t.id === id);
    if (!await showConfirm("warning", "ยืนยันการลบ", "ต้องการลบหมวดหมู่ \"" + (tag?.name || "") + "\" หรือไม่?", "ลบ", "ยกเลิก")) return;
    try {
      await api.delete(getTagUrl(id));
      showAlert("success", "ลบสำเร็จ", "ลบหมวดหมู่เรียบร้อยแล้ว");
      invalidateTags(); fetchTags();
    } catch (err) {
      if (err instanceof SessionExpiredError) setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      else showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถลบหมวดหมู่ได้");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!await showConfirm("warning", "ยืนยันการลบหลายรายการ", "ต้องการลบหมวดหมู่ที่เลือก " + selectedIds.size + " รายการหรือไม่?", "ลบทั้งหมด", "ยกเลิก")) return;
    setDeleting(true);
    try {
      await Promise.all(Array.from(selectedIds).map(id => api.delete(getTagUrl(id))));
      showAlert("success", "ลบสำเร็จ", "ลบหมวดหมู่ " + selectedIds.size + " รายการเรียบร้อยแล้ว");
      setSelectedIds(new Set()); invalidateTags(); fetchTags();
    } catch { showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถลบหมวดหมู่บางรายการได้"); }
    finally { setDeleting(false); }
  };

  const handleCancelEdit = () => { setName(""); setEditingId(null); setShowForm(false); setError(""); };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedTags.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginatedTags.map(t => t.id)));
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <svg className="w-4 h-4 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" /></svg>;
    return sortOrder === "asc" ? <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg> : <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">จัดการหมวดหมู่</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">สร้างและจัดการหมวดหมู่สำหรับรายการรับจ่าย</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setName(""); }} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-sm">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          <span>เพิ่มหมวดหมู่</span>
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">{editingId ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">ชื่อหมวดหมู่</label>
                <input className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" placeholder="เช่น อาหาร, เดินทาง, เงินเดือน" value={name} onChange={(e) => { setName(e.target.value); setError(""); }} required disabled={submitting} autoFocus />
              </div>
              {error && <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"><p className="text-sm text-red-600 dark:text-red-400">{error}</p></div>}
              <div className="flex gap-3">
                <button type="button" onClick={handleCancelEdit} className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">ยกเลิก</button>
                <button type="submit" disabled={submitting || !name.trim()} className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition">{submitting ? "กำลังบันทึก..." : editingId ? "อัพเดต" : "เพิ่ม"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="ค้นหาหมวดหมู่..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" />
          </div>
          {selectedIds.size > 0 && (
            <button onClick={handleBulkDelete} disabled={deleting} className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50 transition">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              <span>ลบที่เลือก ({selectedIds.size})</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          <span>ทั้งหมด {tags.length} หมวดหมู่</span>
          {search && <span>• พบ {filteredTags.length} รายการ</span>}
          {selectedIds.size > 0 && <span>• เลือก {selectedIds.size} รายการ</span>}
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-zinc-500">
            <svg className="w-8 h-8 mx-auto animate-spin text-blue-500 mb-2" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            กำลังโหลด...
          </div>
        ) : filteredTags.length === 0 ? (
          <div className="p-8 text-center">
            <svg className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            <p className="text-zinc-500 dark:text-zinc-400">{search ? "ไม่พบหมวดหมู่ที่ค้นหา" : "ยังไม่มีหมวดหมู่"}</p>
            {!search && <button onClick={() => setShowForm(true)} className="mt-3 text-blue-600 hover:text-blue-700 font-medium">+ เพิ่มหมวดหมู่แรก</button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                <tr>
                  <th className="w-12 px-4 py-3"><input type="checkbox" aria-label="เลือกทั้งหมด" checked={selectedIds.size === paginatedTags.length && paginatedTags.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500" /></th>
                  <th className="px-4 py-3 text-left"><button onClick={() => handleSort("name")} className="flex items-center gap-1 text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 transition">ชื่อหมวดหมู่ <SortIcon field="name" /></button></th>
                  <th className="px-4 py-3 text-right"><span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">จัดการ</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {paginatedTags.map((tag) => (
                  <tr key={tag.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition ${selectedIds.has(tag.id) ? "bg-blue-50 dark:bg-blue-900/20" : ""}`}>
                    <td className="px-4 py-3"><input type="checkbox" aria-label={"เลือก " + tag.name} checked={selectedIds.has(tag.id)} onChange={() => toggleSelect(tag.id)} className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-blue-600 focus:ring-blue-500" /></td>
                    <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full bg-blue-500 shrink-0"></div><span className="font-medium text-zinc-900 dark:text-zinc-100">{tag.name}</span></div></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => handleEdit(tag)} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition" title="แก้ไข"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                        <button onClick={() => handleDelete(tag.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition" title="ลบ"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              หน้า {currentPage} จาก {totalPages} ({filteredTags.length} รายการ)
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                ก่อนหน้า
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
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
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                ถัดไป
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
