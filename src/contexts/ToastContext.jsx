/**
 * Toast notification context.
 * Provides show(message, type) to display toasts app-wide.
 * Types: 'success' | 'error' | 'info' | 'warning'
 */
import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

// ── Toast component ──
const TYPE_STYLES = {
  success: 'bg-green-600 text-white',
  error:   'bg-red-600 text-white',
  info:    'bg-blue-600 text-white',
  warning: 'bg-yellow-500 text-white',
};

const TYPE_ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

function Toast({ toast, onDismiss }) {
  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium
        ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}
        animate-slide-in`}
      role="alert"
    >
      <span className="text-lg">{TYPE_ICONS[toast.type] || 'ℹ'}</span>
      <span className="flex-1">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
