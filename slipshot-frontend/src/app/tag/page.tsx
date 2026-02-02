"use client";

import { useState, useEffect, useCallback } from "react";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS, getTagUrl } from "@/lib/config";
import { useModal } from "@/context/ModalContext";
import { useDataCache } from "@/context/DataCacheContext";
import type { Tag } from "@/lib/types";

export default function TagManager() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const { showAlert, showConfirm } = useModal();
  const { invalidateTags } = useDataCache();

  const fetchTags = useCallback(async () => {
    try {
      const res = await api.get<Tag[]>(API_ENDPOINTS.TAGS);
      if (res.ok && res.data) {
        setTags(res.data);
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const url = editingId ? getTagUrl(editingId) : API_ENDPOINTS.TAGS;
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await api.request(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        setError(res.error || "บันทึกไม่สำเร็จ");
        return;
      }

      showAlert("success", "สำเร็จ", editingId ? "อัพเดตหมวดหมู่เรียบร้อย" : "เพิ่มหมวดหมู่เรียบร้อย");
      setName("");
      setEditingId(null);
      invalidateTags(); // Clear cache
      fetchTags();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (tag: Tag) => {
    setName(tag.name);
    setEditingId(tag.id);
    setError("");
  };

  const handleDelete = async (id: number) => {
    const confirmed = await showConfirm(
      "warning",
      "ยืนยันการลบ",
      "ต้องการลบหมวดหมู่นี้หรือไม่? การลบจะไม่สามารถย้อนกลับได้",
      "ลบ",
      "ยกเลิก"
    );
    
    if (!confirmed) return;

    try {
      await api.delete(getTagUrl(id));
      showAlert("success", "ลบสำเร็จ", "ลบหมวดหมู่เรียบร้อยแล้ว");
      invalidateTags(); // Clear cache
      fetchTags();
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        setError("Session หมดอายุ กรุณาเข้าสู่ระบบใหม่");
      } else {
        showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถลบหมวดหมู่ได้");
      }
    }
  };

  const handleCancelEdit = () => {
    setName("");
    setEditingId(null);
    setError("");
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">จัดการหมวดหมู่</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">สร้างและจัดการหมวดหมู่สำหรับรายการรับจ่าย</p>
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 mb-6 sm:mb-8">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          {editingId ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              ชื่อหมวดหมู่
            </label>
            <input
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="เช่น อาหาร, เดินทาง, เงินเดือน"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              required
              disabled={submitting}
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting || !name.trim()}
              className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {submitting ? "กำลังบันทึก..." : editingId ? "อัพเดต" : "เพิ่มหมวดหมู่"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
              >
                ยกเลิก
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Tag List */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">หมวดหมู่ทั้งหมด</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-zinc-500">กำลังโหลด...</div>
        ) : tags.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">ยังไม่มีหมวดหมู่</div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {tags.map((tag) => (
              <div key={tag.id} className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{tag.name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(tag)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
                    title="แก้ไข"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(tag.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                    title="ลบ"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
