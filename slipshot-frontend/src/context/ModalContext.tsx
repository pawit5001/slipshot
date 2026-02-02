"use client";

import { createContext, useContext, useState, useRef, ReactNode } from "react";

interface ModalState {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ModalContextType {
  showModal: (options: Omit<ModalState, 'isOpen'>) => void;
  showAlert: (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => void;
  showConfirm: (type: 'info' | 'warning', title: string, message: string, confirmLabel?: string, cancelLabel?: string) => Promise<boolean>;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  });
  
  // Store resolve function for confirm dialogs
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const showModal = (options: Omit<ModalState, 'isOpen'>) => {
    setModal({ ...options, isOpen: true });
  };

  const showAlert = (type: 'info' | 'success' | 'warning' | 'error', title: string, message: string) => {
    setModal({ isOpen: true, title, message, type });
  };

  const showConfirm = (
    type: 'info' | 'warning', 
    title: string, 
    message: string, 
    confirmLabel: string = 'ตกลง',
    cancelLabel: string = 'ยกเลิก'
  ): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmResolveRef.current = resolve;
      setModal({ isOpen: true, title, message, type: 'confirm', confirmLabel, cancelLabel });
    });
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const handleConfirm = () => {
    confirmResolveRef.current?.(true);
    confirmResolveRef.current = null;
    closeModal();
  };

  const handleCancel = () => {
    confirmResolveRef.current?.(false);
    confirmResolveRef.current = null;
    closeModal();
  };

  const iconMap = {
    info: (
      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
    success: (
      <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
    warning: (
      <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
    ),
    error: (
      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
    confirm: (
      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
        <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
  };

  return (
    <ModalContext.Provider value={{ showModal, showAlert, showConfirm, closeModal }}>
      {children}
      
      {/* Modal Overlay */}
      {modal.isOpen && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={modal.type !== 'confirm' ? closeModal : undefined}
          />
          
          {/* Modal Content */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              {iconMap[modal.type]}
              
              <h3 className="mt-4 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                {modal.title}
              </h3>
              
              <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                {modal.message}
              </p>
              
              <div className="mt-6 flex gap-3 w-full">
                {modal.type === 'confirm' ? (
                  <>
                    <button
                      onClick={handleCancel}
                      className="flex-1 px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
                    >
                      {modal.cancelLabel || 'ยกเลิก'}
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                    >
                      {modal.confirmLabel || 'ตกลง'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={closeModal}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
                  >
                    ตกลง
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
