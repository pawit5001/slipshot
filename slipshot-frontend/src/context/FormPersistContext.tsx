"use client";
import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ประเภทข้อมูลฟอร์มที่รองรับ
interface FormData {
  [key: string]: unknown;
}

interface FormStore {
  [formKey: string]: FormData;
}

interface FormPersistContextType {
  // บันทึกข้อมูลฟอร์ม
  saveForm: (formKey: string, data: FormData) => void;
  // โหลดข้อมูลฟอร์ม
  loadForm: <T extends FormData>(formKey: string) => T | null;
  // ลบข้อมูลฟอร์ม
  clearForm: (formKey: string) => void;
  // ลบข้อมูลฟอร์มทั้งหมด
  clearAllForms: () => void;
  // อัพเดทฟิลด์เดียวในฟอร์ม
  updateFormField: (formKey: string, fieldName: string, value: unknown) => void;
  // ตรวจสอบว่ามีข้อมูลฟอร์มหรือไม่
  hasFormData: (formKey: string) => boolean;
}

const FormPersistContext = createContext<FormPersistContextType | undefined>(undefined);

export function FormPersistProvider({ children }: { children: ReactNode }) {
  const [formStore, setFormStore] = useState<FormStore>({});

  // บันทึกข้อมูลฟอร์มทั้งหมด
  const saveForm = useCallback((formKey: string, data: FormData) => {
    setFormStore((prev) => ({
      ...prev,
      [formKey]: { ...data },
    }));
  }, []);

  // โหลดข้อมูลฟอร์ม
  const loadForm = useCallback(<T extends FormData>(formKey: string): T | null => {
    return (formStore[formKey] as T) || null;
  }, [formStore]);

  // ลบข้อมูลฟอร์มเฉพาะรายการ
  const clearForm = useCallback((formKey: string) => {
    setFormStore((prev) => {
      const newStore = { ...prev };
      delete newStore[formKey];
      return newStore;
    });
  }, []);

  // ลบข้อมูลฟอร์มทั้งหมด
  const clearAllForms = useCallback(() => {
    setFormStore({});
  }, []);

  // อัพเดทฟิลด์เดียวในฟอร์ม
  const updateFormField = useCallback((formKey: string, fieldName: string, value: unknown) => {
    setFormStore((prev) => ({
      ...prev,
      [formKey]: {
        ...(prev[formKey] || {}),
        [fieldName]: value,
      },
    }));
  }, []);

  // ตรวจสอบว่ามีข้อมูลฟอร์มหรือไม่
  const hasFormData = useCallback((formKey: string): boolean => {
    return formKey in formStore && Object.keys(formStore[formKey]).length > 0;
  }, [formStore]);

  return (
    <FormPersistContext.Provider
      value={{
        saveForm,
        loadForm,
        clearForm,
        clearAllForms,
        updateFormField,
        hasFormData,
      }}
    >
      {children}
    </FormPersistContext.Provider>
  );
}

export function useFormPersist() {
  const context = useContext(FormPersistContext);
  if (!context) {
    throw new Error("useFormPersist must be used within a FormPersistProvider");
  }
  return context;
}

// Custom hook สำหรับใช้กับฟอร์มเฉพาะ
export function usePersistedForm<T extends FormData>(formKey: string, defaultValues: T) {
  const { saveForm, loadForm, clearForm, hasFormData } = useFormPersist();

  // โหลดข้อมูลที่บันทึกไว้ หรือใช้ค่าเริ่มต้น
  const getInitialValues = useCallback((): T => {
    const saved = loadForm<T>(formKey);
    return saved || defaultValues;
  }, [formKey, loadForm, defaultValues]);

  // บันทึกข้อมูลฟอร์ม
  const persist = useCallback((data: T) => {
    saveForm(formKey, data);
  }, [formKey, saveForm]);

  // ล้างข้อมูลฟอร์ม
  const clear = useCallback(() => {
    clearForm(formKey);
  }, [formKey, clearForm]);

  // ตรวจสอบว่ามีข้อมูลที่บันทึกไว้หรือไม่
  const hasSavedData = useCallback(() => {
    return hasFormData(formKey);
  }, [formKey, hasFormData]);

  return {
    getInitialValues,
    persist,
    clear,
    hasSavedData,
  };
}
