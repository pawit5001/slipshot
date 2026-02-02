"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS, getThaiDate, getThaiTime } from "@/lib/config";
import { useModal } from "@/context/ModalContext";
import { useDataCache } from "@/context/DataCacheContext";
import { getUserSettings, setUserSettings } from "@/lib/cache";
import type { OcrResponse, SlipFormData } from "@/lib/types";

const getNow = () => {
  return {
    date: getThaiDate(),
    time: getThaiTime(),
  };
};

interface SlipItem {
  id: string;
  file: File;
  preview: string;
  ocrData: OcrResponse | null;
  ocrLoading: boolean;
  ocrError: string | null;
  form: SlipFormData;
  saving: boolean;
  saved: boolean;
  error: string | null;
}

const createInitialForm = (): SlipFormData => {
  const { date, time } = getNow();
  return {
    account_name: "",
    amount: "",
    date,
    time,
    tag_id: "",
    type: "expense",
    note: "",
  };
};

export default function SlipUploadPage() {
  const [slips, setSlips] = useState<SlipItem[]>([]);
  const [globalError, setGlobalError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [useOcrDateTime, setUseOcrDateTime] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [savingProgress, setSavingProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const { showAlert, showConfirm } = useModal();
  const { tags, fetchTags, invalidateSlips, invalidateDashboard } = useDataCache();

  useEffect(() => {
    fetchTags();
    // Load user preference
    const settings = getUserSettings();
    setUseOcrDateTime(settings.useOcrDateTime);
  }, [fetchTags]);

  // Set default tag when tags load
  useEffect(() => {
    if (tags.length > 0) {
      const defaultTag = tags.find(t => t.name === "ไม่ระบุ") || tags[0];
      if (defaultTag) {
        setSlips(prev => prev.map(slip => 
          !slip.form.tag_id ? { ...slip, form: { ...slip.form, tag_id: defaultTag.id.toString() } } : slip
        ));
      }
    }
  }, [tags]);

  // Handle paste event globally
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }

      if (imageFiles.length > 0) {
        e.preventDefault();
        await processFiles(imageFiles);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [tags]);

  const processFiles = async (files: File[]) => {
    setGlobalError("");
    const defaultTag = tags.find(t => t.name === "ไม่ระบุ") || tags[0];
    
    const newSlips: SlipItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      ocrData: null,
      ocrLoading: true,
      ocrError: null,
      form: {
        ...createInitialForm(),
        tag_id: defaultTag?.id.toString() || "",
      },
      saving: false,
      saved: false,
      error: null,
    }));

    setSlips(prev => [...prev, ...newSlips]);

    // Process OCR for all files in parallel (faster!)
    await Promise.all(newSlips.map(slip => processOcr(slip.id, slip.file)));
  };

  const processOcr = async (slipId: string, file: File) => {
    const formData = new FormData();
    formData.append("image", file);

    // Get latest setting
    const settings = getUserSettings();
    const useOcr = settings.useOcrDateTime;

    try {
      const res = await api.postForm<OcrResponse>(API_ENDPOINTS.SLIP_OCR, formData);

      setSlips(prev => prev.map(slip => {
        if (slip.id !== slipId) return slip;

        // ถ้าไม่ใช่ slip (status 400) ให้แสดง error และลบออก
        if (!res.ok) {
          // ถ้าเป็น error "ไม่พบข้อมูลสลิป" ให้ลบรูปออกพร้อมแจ้งเตือน
          const errorMsg = res.error || "OCR ไม่สำเร็จ";
          if (errorMsg.includes('ไม่พบข้อมูลสลิป') || errorMsg.includes('ไม่ใช่สลิป')) {
            return { ...slip, ocrLoading: false, ocrError: "รูปนี้ไม่ใช่สลิปโอนเงิน กรุณาอัพโหลดรูปสลิปธนาคาร", ocrData: null };
          }
          return { ...slip, ocrLoading: false, ocrError: errorMsg };
        }

        // ตรวจสอบว่าเป็น valid slip หรือไม่
        if (res.data?.is_valid_slip === false) {
          return { ...slip, ocrLoading: false, ocrError: "รูปนี้ไม่ใช่สลิปโอนเงิน กรุณาอัพโหลดรูปสลิปธนาคาร", ocrData: null };
        }

        const extracted = res.data?.extracted;
        const newForm = { ...slip.form };

        if (extracted) {
          // ใช้ transaction_title เป็น account_name ถ้ามี
          if (extracted.transaction_title) {
            newForm.account_name = extracted.transaction_title;
          } else if (extracted.account_name) {
            newForm.account_name = extracted.account_name;
          }
          
          if (extracted.amount) {
            newForm.amount = extracted.amount.toString();
          }
          
          // ใช้วันที่ตามการตั้งค่า
          if (useOcr && extracted.date) {
            newForm.date = extracted.date;
          }
          // ถ้าไม่ใช้ OCR date/time จะใช้วันเวลาปัจจุบันที่ตั้งไว้ใน createInitialForm()
          
          // เวลา - ถ้าผู้ใช้เลือกใช้ OCR และมีเวลาจาก OCR
          if (useOcr && extracted.time) {
            newForm.time = extracted.time;
          }
          
          if (extracted.type) {
            newForm.type = extracted.type;
          }
        } else if (res.data?.found_names?.[0]) {
          newForm.account_name = res.data.found_names[0];
        }

        return {
          ...slip,
          ocrData: res.data || null,
          ocrLoading: false,
          form: newForm,
        };
      }));
    } catch (err) {
      setSlips(prev => prev.map(slip => {
        if (slip.id !== slipId) return slip;
        return {
          ...slip,
          ocrLoading: false,
          ocrError: err instanceof SessionExpiredError
            ? "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่"
            : "เกิดข้อผิดพลาดในการอ่านข้อมูล",
        };
      }));
    }
  };

  const toggleUseOcrDateTime = () => {
    const newValue = !useOcrDateTime;
    setUseOcrDateTime(newValue);
    setUserSettings({ useOcrDateTime: newValue });
    
    // Update existing slips' date/time based on new setting
    setSlips(prev => prev.map(slip => {
      // Skip if no OCR data or already saved
      if (!slip.ocrData?.extracted || slip.saved) return slip;
      
      const extracted = slip.ocrData.extracted;
      const { date: currentDate, time: currentTime } = getNow();
      
      return {
        ...slip,
        form: {
          ...slip.form,
          // If newValue=true (use OCR), use OCR date/time; else use current
          date: newValue && extracted.date ? extracted.date : currentDate,
          time: newValue && extracted.time ? extracted.time : currentTime,
        }
      };
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await processFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length > 0) {
      await processFiles(files);
    }
  }, [tags]);

  const updateSlipForm = (slipId: string, updates: Partial<SlipFormData>) => {
    setSlips(prev => prev.map(slip => 
      slip.id === slipId ? { ...slip, form: { ...slip.form, ...updates } } : slip
    ));
  };

  const removeSlip = (slipId: string) => {
    setSlips(prev => {
      const slip = prev.find(s => s.id === slipId);
      if (slip?.preview) {
        URL.revokeObjectURL(slip.preview);
      }
      return prev.filter(s => s.id !== slipId);
    });
  };

  const saveSlip = async (slipId: string) => {
    const slip = slips.find(s => s.id === slipId);
    if (!slip) return;

    // Validate ก่อนบันทึก
    if (!slip.form.account_name.trim()) {
      await showAlert("error", "ข้อมูลไม่ครบ", "กรุณากรอกชื่อรายการ");
      return;
    }
    if (!slip.form.amount || isNaN(Number(slip.form.amount)) || Number(slip.form.amount) <= 0) {
      await showAlert("error", "ข้อมูลไม่ครบ", "กรุณากรอกจำนวนเงินให้ถูกต้อง");
      return;
    }

    setSlips(prev => prev.map(s => 
      s.id === slipId ? { ...s, saving: true, error: null } : s
    ));

    const formData = new FormData();
    formData.append("account_name", slip.form.account_name);
    formData.append("amount", slip.form.amount);
    formData.append("date", slip.form.date);
    if (slip.form.time) formData.append("time", slip.form.time);
    formData.append("type", slip.form.type);
    if (slip.form.tag_id) formData.append("tag_id", slip.form.tag_id);
    if (slip.form.note) formData.append("note", slip.form.note);
    formData.append("image", slip.file);

    try {
      const res = await api.postForm(API_ENDPOINTS.SLIPS, formData);

      if (!res.ok) {
        const errorMsg = res.error || "บันทึกไม่สำเร็จ";
        setSlips(prev => prev.map(s => 
          s.id === slipId ? { ...s, saving: false, error: errorMsg } : s
        ));
        await showAlert("error", "ไม่สำเร็จ", errorMsg);
        return;
      }

      setSlips(prev => prev.map(s => 
        s.id === slipId ? { ...s, saving: false, saved: true } : s
      ));
      invalidateSlips();
      invalidateDashboard();
    } catch (err) {
      const errorMsg = err instanceof SessionExpiredError 
        ? "Session หมดอายุ" 
        : "เกิดข้อผิดพลาด";
      setSlips(prev => prev.map(s => 
        s.id === slipId ? { 
          ...s, 
          saving: false, 
          error: errorMsg
        } : s
      ));
      await showAlert("error", "ไม่สำเร็จ", errorMsg);
    }
  };

  const saveAllSlips = async () => {
    const unsavedSlips = slips.filter(s => !s.saved && !s.ocrLoading && !s.ocrError);
    if (unsavedSlips.length === 0) return;

    setSavingAll(true);
    setSavingProgress({ current: 0, total: unsavedSlips.length });

    // Validate all slips before saving
    const invalidSlips: string[] = [];
    for (const unsavedSlip of unsavedSlips) {
      const slip = slips.find(s => s.id === unsavedSlip.id);
      if (!slip) continue;
      
      if (!slip.form.account_name.trim()) {
        invalidSlips.push(`สลิป ${slips.indexOf(slip) + 1}: ไม่มีชื่อบัญชี`);
      }
      const amount = parseFloat(slip.form.amount);
      if (isNaN(amount) || amount <= 0) {
        invalidSlips.push(`สลิป ${slips.indexOf(slip) + 1}: จำนวนเงินไม่ถูกต้อง`);
      }
    }
    
    if (invalidSlips.length > 0) {
      setSavingAll(false);
      showAlert("error", "ข้อมูลไม่ครบ", invalidSlips.slice(0, 5).join("\n") + (invalidSlips.length > 5 ? `\n...และอีก ${invalidSlips.length - 5} รายการ` : ""));
      return;
    }

    let successCount = 0;
    let failCount = 0;
    for (let i = 0; i < unsavedSlips.length; i++) {
      setSavingProgress({ current: i + 1, total: unsavedSlips.length });
      
      const slipId = unsavedSlips[i].id;
      const slip = slips.find(s => s.id === slipId);
      if (!slip) continue;
      
      // Mark as saving
      setSlips(prev => prev.map(s => 
        s.id === slipId ? { ...s, saving: true, error: null } : s
      ));

      const formData = new FormData();
      formData.append("account_name", slip.form.account_name);
      formData.append("amount", slip.form.amount);
      formData.append("date", slip.form.date);
      if (slip.form.time) formData.append("time", slip.form.time);
      formData.append("type", slip.form.type);
      if (slip.form.tag_id) formData.append("tag_id", slip.form.tag_id);
      if (slip.form.note) formData.append("note", slip.form.note);
      formData.append("image", slip.file);

      try {
        const res = await api.postForm(API_ENDPOINTS.SLIPS, formData);

        if (res.ok) {
          setSlips(prev => prev.map(s => 
            s.id === slipId ? { ...s, saving: false, saved: true } : s
          ));
          successCount++;
        } else {
          setSlips(prev => prev.map(s => 
            s.id === slipId ? { ...s, saving: false, error: res.error || "บันทึกไม่สำเร็จ" } : s
          ));
          failCount++;
        }
      } catch (err) {
        setSlips(prev => prev.map(s => 
          s.id === slipId ? { 
            ...s, 
            saving: false, 
            error: err instanceof SessionExpiredError 
              ? "Session หมดอายุ" 
              : "เกิดข้อผิดพลาด" 
          } : s
        ));
        failCount++;
      }
    }

    setSavingAll(false);
    invalidateSlips();
    invalidateDashboard();
    
    if (failCount > 0 && successCount === 0) {
      showAlert("error", "ไม่สำเร็จ", `บันทึกไม่สำเร็จ ${failCount} รายการ`);
    } else if (failCount > 0) {
      showAlert("warning", "บางส่วนไม่สำเร็จ", `บันทึกสำเร็จ ${successCount} รายการ, ไม่สำเร็จ ${failCount} รายการ`);
    } else if (successCount > 0) {
      showAlert("success", "สำเร็จ", `บันทึก ${successCount} รายการเรียบร้อย`);
      // Redirect to slip list page after saving
      router.push("/slip");
    }
  };

  const clearAllSlips = async () => {
    const confirmed = await showConfirm("warning", "ยืนยัน", "ต้องการลบรูปทั้งหมดหรือไม่?");
    if (confirmed) {
      slips.forEach(slip => URL.revokeObjectURL(slip.preview));
      setSlips([]);
    }
  };

  const formatThaiDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const unsavedCount = slips.filter(s => !s.saved && !s.ocrLoading && !s.ocrError).length;
  const savedCount = slips.filter(s => s.saved).length;
  const loadingCount = slips.filter(s => s.ocrLoading).length;
  const errorCount = slips.filter(s => s.ocrError).length;

  const removeInvalidSlips = async () => {
    const invalidSlips = slips.filter(s => s.ocrError);
    if (invalidSlips.length === 0) return;
    
    const confirmed = await showConfirm("warning", "ยืนยัน", `ต้องการลบ ${invalidSlips.length} รูปที่ไม่ใช่สลิปหรือไม่?`);
    if (confirmed) {
      invalidSlips.forEach(slip => URL.revokeObjectURL(slip.preview));
      setSlips(prev => prev.filter(s => !s.ocrError));
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Saving All Overlay */}
      {savingAll && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 shadow-2xl max-w-sm w-full mx-4">
            <div className="flex flex-col items-center">
              {/* Spinner */}
              <div className="relative mb-6">
                <svg className="w-20 h-20 animate-spin" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                  <circle className="opacity-75 text-blue-600" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-bold text-blue-600">{savingProgress.current}/{savingProgress.total}</span>
                </div>
              </div>
              
              {/* Progress Text */}
              <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                กำลังบันทึกสลิป...
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-center">
                รายการที่ {savingProgress.current} จาก {savingProgress.total}
              </p>
              
              {/* Progress Bar */}
              <div className="w-full mt-4 bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${(savingProgress.current / savingProgress.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <Link
            href="/slip"
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">เพิ่มสลิป</h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
              อัพโหลดหรือวางรูปสลิป (รองรับหลายรูป)
            </p>
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative mb-4 border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-zinc-300 dark:border-zinc-700 hover:border-blue-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
        }`}
      >
        <input
          type="file"
          accept="image/*"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          title="เลือกไฟล์รูปสลิป"
        />
        
        <div className="flex flex-col items-center gap-4">
          <div className={`p-4 rounded-full ${dragActive ? "bg-blue-100 dark:bg-blue-800" : "bg-zinc-100 dark:bg-zinc-800"}`}>
            <svg className={`w-8 h-8 ${dragActive ? "text-blue-600" : "text-zinc-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          
          <div>
            <p className="text-zinc-700 dark:text-zinc-300 font-medium mb-1">
              ลากรูปมาวาง หรือ <button type="button" onClick={() => fileInputRef.current?.click()} className="text-blue-600 hover:underline">เลือกไฟล์</button>
            </p>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">
              รองรับ PNG, JPG, JPEG • สามารถวาง (Ctrl+V) ได้
            </p>
          </div>
        </div>
      </div>

      {/* Date/Time Source Toggle */}
      <div className="flex items-center justify-end gap-3 mb-6 px-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {useOcrDateTime ? "ใช้วันเวลาจากสลิป" : "ใช้วันเวลาปัจจุบัน"}
          </span>
          <button
            type="button"
            onClick={toggleUseOcrDateTime}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              useOcrDateTime 
                ? "bg-blue-600" 
                : "bg-zinc-300 dark:bg-zinc-600"
            }`}
          >
            <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
              useOcrDateTime ? "translate-x-5" : ""
            }`} />
          </button>
        </label>
      </div>

      {/* Status Bar */}
      {slips.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-4 text-sm">
            <span className="text-zinc-600 dark:text-zinc-400">
              ทั้งหมด: <span className="font-medium text-zinc-900 dark:text-zinc-100">{slips.length}</span>
            </span>
            {loadingCount > 0 && (
              <span className="text-blue-600">
                กำลังอ่าน: <span className="font-medium">{loadingCount}</span>
              </span>
            )}
            {errorCount > 0 && (
              <span className="text-red-600">
                ไม่ใช่สลิป: <span className="font-medium">{errorCount}</span>
              </span>
            )}
            {unsavedCount > 0 && (
              <span className="text-amber-600">
                รอบันทึก: <span className="font-medium">{unsavedCount}</span>
              </span>
            )}
            {savedCount > 0 && (
              <span className="text-emerald-600">
                บันทึกแล้ว: <span className="font-medium">{savedCount}</span>
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            {errorCount > 0 && (
              <button
                type="button"
                onClick={removeInvalidSlips}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
              >
                ลบรูปไม่ใช่สลิป ({errorCount})
              </button>
            )}
            <button
              type="button"
              onClick={clearAllSlips}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
            >
              ลบทั้งหมด
            </button>
            <button
              type="button"
              onClick={saveAllSlips}
              disabled={unsavedCount === 0 || loadingCount > 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
            >
              บันทึกทั้งหมด ({unsavedCount})
            </button>
          </div>
        </div>
      )}

      {globalError && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-red-600 dark:text-red-400">{globalError}</p>
        </div>
      )}

      {/* Slip Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {slips.map((slip, index) => (
          <div
            key={slip.id}
            className={`bg-white dark:bg-zinc-900 rounded-xl border overflow-hidden transition-all ${
              slip.saved 
                ? "border-emerald-300 dark:border-emerald-700" 
                : slip.ocrError
                  ? "border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10"
                  : slip.error 
                    ? "border-red-300 dark:border-red-700"
                    : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            {/* Card Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${
              slip.ocrError 
                ? "border-red-200 dark:border-red-800 bg-red-100 dark:bg-red-900/30" 
                : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50"
            }`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  #{index + 1}
                </span>
                {slip.ocrLoading && (
                  <span className="flex items-center gap-1 text-xs text-blue-600">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    กำลังอ่าน...
                  </span>
                )}
                {slip.ocrError && (
                  <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    ไม่ใช่สลิป
                  </span>
                )}
                {slip.saved && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    บันทึกแล้ว
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeSlip(slip.id)}
                className="p-1 text-zinc-400 hover:text-red-500 transition"
                title="ลบ"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              {/* Image Preview */}
              <div className="mb-4">
                <img
                  src={slip.preview}
                  alt={`Slip ${index + 1}`}
                  className="w-full h-40 object-contain bg-zinc-100 dark:bg-zinc-800 rounded-lg"
                />
              </div>

              {/* OCR Error */}
              {slip.ocrError && (
                <div className="mb-4 p-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded">
                  {slip.ocrError}
                </div>
              )}

              {/* Form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Account Name / Transaction Title */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      ชื่อรายการ
                    </label>
                    <input
                      type="text"
                      value={slip.form.account_name}
                      onChange={(e) => updateSlipForm(slip.id, { account_name: e.target.value })}
                      placeholder="เช่น เติมเงินสำเร็จ, โอนเงินสำเร็จ"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      disabled={slip.saving || slip.saved}
                    />
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      จำนวนเงิน
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={slip.form.amount}
                      onChange={(e) => updateSlipForm(slip.id, { amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      disabled={slip.saving || slip.saved}
                    />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      ประเภท
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={() => updateSlipForm(slip.id, { type: "expense" })}
                        disabled={slip.saving || slip.saved}
                        className={`px-2 py-2 text-xs font-medium rounded-lg border transition ${
                          slip.form.type === "expense"
                            ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20 text-rose-600"
                            : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        รายจ่าย
                      </button>
                      <button
                        type="button"
                        onClick={() => updateSlipForm(slip.id, { type: "income" })}
                        disabled={slip.saving || slip.saved}
                        className={`px-2 py-2 text-xs font-medium rounded-lg border transition ${
                          slip.form.type === "income"
                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600"
                            : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"
                        }`}
                      >
                        รายรับ
                      </button>
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      วันที่
                    </label>
                    <input
                      type="date"
                      value={slip.form.date}
                      onChange={(e) => updateSlipForm(slip.id, { date: e.target.value })}
                      title="วันที่"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      disabled={slip.saving || slip.saved}
                    />
                  </div>

                  {/* Time */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      เวลา
                    </label>
                    <input
                      type="time"
                      value={slip.form.time}
                      onChange={(e) => updateSlipForm(slip.id, { time: e.target.value })}
                      title="เวลา"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      disabled={slip.saving || slip.saved}
                    />
                  </div>

                  {/* Category */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      หมวดหมู่
                    </label>
                    <select
                      value={slip.form.tag_id}
                      onChange={(e) => updateSlipForm(slip.id, { tag_id: e.target.value })}
                      title="เลือกหมวดหมู่"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      disabled={slip.saving || slip.saved}
                    >
                      {tags.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Note */}
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                      หมายเหตุ (ค้นหาได้)
                    </label>
                    <input
                      type="text"
                      value={slip.form.note}
                      onChange={(e) => updateSlipForm(slip.id, { note: e.target.value })}
                      placeholder="เพิ่มหมายเหตุ..."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      disabled={slip.saving || slip.saved}
                    />
                  </div>
                </div>

                {/* Error */}
                {slip.error && (
                  <div className="p-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded">
                    {slip.error}
                  </div>
                )}

                {/* Save Button */}
                {!slip.saved && (
                  <button
                    type="button"
                    onClick={() => saveSlip(slip.id)}
                    disabled={slip.saving || slip.ocrLoading || !slip.form.account_name || !slip.form.amount}
                    className="w-full py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition"
                  >
                    {slip.saving ? "กำลังบันทึก..." : "บันทึก"}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {slips.length === 0 && (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium mb-1">ยังไม่มีสลิป</p>
          <p className="text-sm">ลากรูปมาวาง เลือกไฟล์ หรือวาง (Ctrl+V)</p>
        </div>
      )}

      {/* Done Button */}
      {savedCount > 0 && savedCount === slips.length && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push("/slip")}
            className="px-6 py-3 text-base font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition"
          >
            เสร็จสิ้น - ดูรายการสลิป
          </button>
        </div>
      )}
    </div>
  );
}
