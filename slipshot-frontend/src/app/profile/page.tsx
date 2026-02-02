"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, SessionExpiredError } from "@/lib/api";
import { API_ENDPOINTS } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import type { User } from "@/lib/types";

interface PasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

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
    errors.push("ต้องมีอักขระพิเศษอย่างน้อย 1 ตัว (!@#$%^&*...)");
  }
  
  // Common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty123', 'abc12345'];
  if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
    errors.push("รหัสผ่านง่ายเกินไป");
  }
  
  return { valid: errors.length === 0, errors };
};

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // Profile form
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
  });
  
  // Password form
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  
  const router = useRouter();
  const { refreshUser } = useAuth();

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get<User>(API_ENDPOINTS.USER_PROFILE);
      if (res.ok && res.data) {
        setUser(res.data);
        setProfileForm({
          first_name: res.data.first_name || "",
          last_name: res.data.last_name || "",
          email: res.data.email || "",
        });
      } else {
        router.push("/auth/login");
      }
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        router.push("/auth/login");
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Validate password on change
  useEffect(() => {
    if (passwordForm.new_password) {
      const { errors } = validatePassword(passwordForm.new_password);
      setPasswordErrors(errors);
    } else {
      setPasswordErrors([]);
    }
  }, [passwordForm.new_password]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const res = await api.put(API_ENDPOINTS.USER_PROFILE, profileForm);
      if (res.ok) {
        setSuccess("บันทึกข้อมูลสำเร็จ");
        fetchProfile();
        // Refresh auth context to update navbar
        refreshUser();
      } else {
        setError(res.error || "ไม่สามารถบันทึกข้อมูลได้");
      }
    } catch {
      setError("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validation
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setError("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }

    const { valid, errors } = validatePassword(passwordForm.new_password);
    if (!valid) {
      setError(errors.join(", "));
      return;
    }

    if (passwordForm.current_password === passwordForm.new_password) {
      setError("รหัสผ่านใหม่ต้องไม่เหมือนกับรหัสผ่านเดิม");
      return;
    }

    setSaving(true);

    try {
      const res = await api.post(API_ENDPOINTS.CHANGE_PASSWORD, {
        old_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });

      if (res.ok) {
        setSuccess("เปลี่ยนรหัสผ่านสำเร็จ! กำลังออกจากระบบ...");
        setPasswordForm({
          current_password: "",
          new_password: "",
          confirm_password: "",
        });
        // Redirect to login after password change
        setTimeout(() => {
          router.push("/auth/login");
        }, 1500);
      } else {
        setError(res.error || "ไม่สามารถเปลี่ยนรหัสผ่านได้");
      }
    } catch {
      setError("เกิดข้อผิดพลาด");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-48 mb-8"></div>
          <div className="space-y-4">
            <div className="h-12 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
            <div className="h-12 bg-zinc-200 dark:bg-zinc-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">โปรไฟล์</h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">จัดการข้อมูลส่วนตัวและรหัสผ่าน</p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* User Info Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shrink-0">
            <span className="text-xl sm:text-2xl font-bold text-white">
              {user?.first_name?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {user?.first_name} {user?.last_name}
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400">@{user?.username}</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          ข้อมูลส่วนตัว
        </h3>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first_name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                ชื่อ
              </label>
              <input
                id="first_name"
                type="text"
                value={profileForm.first_name}
                onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="ชื่อจริง"
              />
            </div>
            <div>
              <label htmlFor="last_name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                นามสกุล
              </label>
              <input
                id="last_name"
                type="text"
                value={profileForm.last_name}
                onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="นามสกุล"
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              อีเมล <span className="text-zinc-400 font-normal">(ไม่บังคับ)</span>
            </label>
            <input
              id="email"
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              className="w-full px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="example@email.com"
            />
          </div>
          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </button>
          </div>
        </form>
      </div>

      {/* Password Form */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          เปลี่ยนรหัสผ่าน
        </h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label htmlFor="current_password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              รหัสผ่านปัจจุบัน
            </label>
            <div className="relative">
              <input
                id="current_password"
                type={showCurrentPassword ? "text" : "password"}
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="รหัสผ่านปัจจุบัน"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
              >
                {showCurrentPassword ? (
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
          </div>
          
          <div>
            <label htmlFor="new_password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              รหัสผ่านใหม่
            </label>
            <div className="relative">
              <input
                id="new_password"
                type={showNewPassword ? "text" : "password"}
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                className="w-full px-4 py-2.5 pr-12 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="รหัสผ่านใหม่"
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
              >
                {showNewPassword ? (
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
            {passwordForm.new_password && (
              <div className="mt-2 space-y-1">
                {passwordErrors.length > 0 ? (
                  passwordErrors.map((err, idx) => (
                    <p key={idx} className="text-xs text-red-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {err}
                    </p>
                  ))
                ) : (
                  <p className="text-xs text-green-500 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    รหัสผ่านผ่านเกณฑ์
                  </p>
                )}
              </div>
            )}
          </div>
          
          <div>
            <label htmlFor="confirm_password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              ยืนยันรหัสผ่านใหม่
            </label>
            <input
              id="confirm_password"
              type="password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              className={`w-full px-4 py-2.5 rounded-lg border ${
                passwordForm.confirm_password && passwordForm.confirm_password !== passwordForm.new_password
                  ? 'border-red-500'
                  : 'border-zinc-300 dark:border-zinc-700'
              } bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition`}
              placeholder="ยืนยันรหัสผ่านใหม่"
              required
            />
            {passwordForm.confirm_password && passwordForm.confirm_password !== passwordForm.new_password && (
              <p className="mt-1 text-xs text-red-500">รหัสผ่านไม่ตรงกัน</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving || passwordErrors.length > 0 || passwordForm.new_password !== passwordForm.confirm_password}
              className="px-6 py-2.5 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? "กำลังเปลี่ยน..." : "เปลี่ยนรหัสผ่าน"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
