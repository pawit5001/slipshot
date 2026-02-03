"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_ENDPOINTS, API_BASE_URL } from "@/lib/config";
import { useModal } from "@/context/ModalContext";
import { useAuth } from "@/context/AuthContext";
import Footer from "@/components/Footer";

// Password validation rules
const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("ต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("ต้องมีตัวอักษรพิมพ์เล็กอย่างน้อย 1 ตัว");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("ต้องมีตัวเลขอย่างน้อย 1 ตัว");
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push("ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว");
  }
  
  return { valid: errors.length === 0, errors };
};

// Name validation
const validateName = (name: string, fieldName: string): string | null => {
  if (!name.trim()) {
    return `กรุณากรอก${fieldName}`;
  }
  if (name.trim().length < 2) {
    return `${fieldName}ต้องมีอย่างน้อย 2 ตัวอักษร`;
  }
  if (!/^[ก-๙a-zA-Z\s]+$/.test(name)) {
    return `${fieldName}ต้องเป็นตัวอักษรภาษาไทยหรืออังกฤษเท่านั้น`;
  }
  return null;
};

// Username validation: allow letters, numbers, dot, underscore, hyphen. Min 3, max 30.
const validateUsername = (username: string): string | null => {
  const trimmed = username.trim();
  if (!trimmed) return "กรุณากรอกชื่อผู้ใช้";
  if (trimmed.length < 3) return "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร";
  if (trimmed.length > 30) return "ชื่อผู้ใช้ต้องไม่เกิน 30 ตัวอักษร";
  if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return "ชื่อผู้ใช้ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข . _ - เท่านั้น";
  }
  return null;
};

// แปลง error message เป็นภาษาไทย
const translateError = (error: string): string => {
  const errorMap: Record<string, string> = {
    "A user with that username already exists.": "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว",
    "This username is already taken": "ชื่อผู้ใช้นี้ถูกใช้งานแล้ว",
    "User with this name already exists": "มีผู้ใช้ที่ใช้ชื่อและนามสกุลนี้แล้ว",
    "Name combination already exists": "มีผู้ใช้ที่ใช้ชื่อและนามสกุลนี้แล้ว",
    "Password too common": "รหัสผ่านนี้ง่ายเกินไป กรุณาใช้รหัสผ่านอื่น",
    "Password is too common": "รหัสผ่านนี้ง่ายเกินไป กรุณาใช้รหัสผ่านอื่น",
    "This password is too common.": "รหัสผ่านนี้ง่ายเกินไป กรุณาใช้รหัสผ่านอื่น",
    "Network Error": "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้",
  };
  
  return errorMap[error] || error;
};

export default function RegisterPage() {

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
  });
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [nameErrors, setNameErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { showAlert } = useModal();
  const { user, loading: authLoading, refreshUser } = useAuth();

  // Always force session check on register page
  useEffect(() => {
    refreshUser(true);
  }, [refreshUser]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, authLoading, router]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'firstName') {
      const error = validateName(value, 'ชื่อ');
      setNameErrors(prev => ({ ...prev, firstName: error || undefined }));
    }
    if (field === 'lastName') {
      const error = validateName(value, 'นามสกุล');
      setNameErrors(prev => ({ ...prev, lastName: error || undefined }));
    }
    if (field === 'username') {
      const error = validateUsername(value);
      setUsernameError(error || null);
    }
  };

  useEffect(() => {
    if (formData.password) {
      const { errors } = validatePassword(formData.password);
      setPasswordErrors(errors);
    } else {
      setPasswordErrors([]);
    }
  }, [formData.password]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();

    const firstNameError = validateName(formData.firstName, 'ชื่อ');
    const lastNameError = validateName(formData.lastName, 'นามสกุล');
    
    if (firstNameError || lastNameError) {
      setNameErrors({
        firstName: firstNameError || undefined,
        lastName: lastNameError || undefined,
      });
      showAlert("error", "ข้อมูลไม่ถูกต้อง", firstNameError || lastNameError || "กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    // Username validation before submit
    if (!formData.username.trim()) {
      showAlert("error", "ข้อมูลไม่ถูกต้อง", "กรุณากรอกชื่อผู้ใช้");
      return;
    }
    if (usernameError) {
      showAlert("error", "ชื่อผู้ใช้ไม่ถูกต้อง", usernameError);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showAlert("error", "รหัสผ่านไม่ตรงกัน", "กรุณากรอกรหัสผ่านให้ตรงกันทั้งสองช่อง");
      return;
    }
    
    const { valid, errors } = validatePassword(formData.password);
    if (!valid) {
      showAlert("error", "รหัสผ่านไม่ผ่านเกณฑ์", errors.join("\n"));
      return;
    }

    setLoading(true);
    
    try {
      const checkRes = await fetch(`${API_BASE_URL}/api/auth/check-name/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
        }),
      });
      
      if (!checkRes.ok) {
        const checkData = await checkRes.json().catch(() => ({}));
        if (checkData?.exists) {
          showAlert("error", "ชื่อซ้ำ", "มีผู้ใช้ที่ใช้ชื่อและนามสกุลนี้แล้ว กรุณาใช้ชื่ออื่น");
          setLoading(false);
          return;
        }
      }

      const res = await fetch(API_ENDPOINTS.REGISTER, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
        }),
      });
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const errorMessage = data?.detail || data?.username?.[0] || data?.first_name?.[0] || data?.last_name?.[0] || "การสมัครสมาชิกไม่สำเร็จ";
        showAlert("error", "สมัครสมาชิกไม่สำเร็จ", translateError(errorMessage));
        setLoading(false);
        return;
      }
      
      showAlert("success", "สมัครสมาชิกสำเร็จ", "กำลังพาไปหน้าเข้าสู่ระบบ...");
      setTimeout(() => router.push("/auth/login"), 1500);
    } catch {
      showAlert("error", "เกิดข้อผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-900">
      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              <Link href="/" className="inline-block">SlipShot</Link>
            </h1>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">เริ่มต้นจัดการการเงินอย่างชาญฉลาด</p>
          </div>

          {/* Register Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-6 sm:p-8">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">สมัครสมาชิก</h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">สร้างบัญชีใหม่ฟรี</p>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    ชื่อ <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      nameErrors.firstName 
                        ? 'border-red-300 dark:border-red-500/50' 
                        : 'border-zinc-300 dark:border-zinc-600'
                    } bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm`}
                    placeholder="ชื่อ"
                    value={formData.firstName}
                    onChange={(e) => updateField("firstName", e.target.value)}
                    required
                    disabled={loading}
                  />
                  {nameErrors.firstName && (
                    <p className="mt-1 text-xs text-red-500">{nameErrors.firstName}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                    นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    className={`w-full px-4 py-2.5 rounded-xl border ${
                      nameErrors.lastName 
                        ? 'border-red-300 dark:border-red-500/50' 
                        : 'border-zinc-300 dark:border-zinc-600'
                    } bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm`}
                    placeholder="นามสกุล"
                    value={formData.lastName}
                    onChange={(e) => updateField("lastName", e.target.value)}
                    required
                    disabled={loading}
                  />
                  {nameErrors.lastName && (
                    <p className="mt-1 text-xs text-red-500">{nameErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  ชื่อผู้ใช้ <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                  placeholder="กรอกชื่อผู้ใช้"
                  value={formData.username}
                  onChange={(e) => updateField("username", e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
                  {usernameError && (
                    <p className="mt-1 text-xs text-red-500">{usernameError}</p>
                  )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  รหัสผ่าน <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    className="w-full px-4 py-2.5 pr-12 rounded-xl border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    required
                    disabled={loading}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                
                {/* Password Requirements */}
                {formData.password && (
                  <div className="mt-2 space-y-1">
                    {passwordErrors.length > 0 ? (
                      passwordErrors.map((err, idx) => (
                        <p key={idx} className="text-xs text-red-500 flex items-center gap-1">
                          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          {err}
                        </p>
                      ))
                    ) : (
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        รหัสผ่านผ่านเกณฑ์
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                  ยืนยันรหัสผ่าน <span className="text-red-500">*</span>
                </label>
                <input
                  className={`w-full px-4 py-2.5 rounded-xl border ${
                    formData.confirmPassword && formData.confirmPassword !== formData.password
                      ? 'border-red-300 dark:border-red-500/50'
                      : 'border-zinc-300 dark:border-zinc-600'
                  } bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm`}
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField("confirmPassword", e.target.value)}
                  required
                  disabled={loading}
                  autoComplete="new-password"
                />
                {formData.confirmPassword && formData.confirmPassword !== formData.password && (
                  <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    รหัสผ่านไม่ตรงกัน
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || passwordErrors.length > 0 || formData.password !== formData.confirmPassword || Boolean(usernameError)}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    กำลังสมัครสมาชิก...
                  </span>
                ) : (
                  "สมัครสมาชิก"
                )}
              </button>
            </form>

            {/* Login Link */}
            <p className="text-center text-zinc-600 dark:text-zinc-400 text-sm mt-6">
              มีบัญชีอยู่แล้ว?{" "}
              <Link href="/auth/login" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium">
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
