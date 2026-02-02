'use client';

interface AlertProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose?: () => void;
}

export function Alert({ type, message, onClose }: AlertProps) {
  const styles = {
    success: 'bg-green-50 border-green-500 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    error: 'bg-red-50 border-red-500 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    warning: 'bg-yellow-50 border-yellow-500 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    info: 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  };

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div className={`flex items-center gap-3 rounded-lg border-l-4 p-4 ${styles[type]}`}>
      <span className="text-lg">{icons[type]}</span>
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="text-current opacity-60 hover:opacity-100 transition"
        >
          ✕
        </button>
      )}
    </div>
  );
}
