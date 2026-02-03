'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type ToastType = 'error' | 'success' | 'info' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  showError: (message: string) => void;
  showSuccess: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);

    // Auto remove after 5 seconds
    setTimeout(() => removeToast(id), 5000);
  }, [removeToast]);

  const showError = useCallback((message: string) => showToast(message, 'error'), [showToast]);
  const showSuccess = useCallback((message: string) => showToast(message, 'success'), [showToast]);

  const typeStyles: Record<ToastType, string> = {
    error: 'bg-red-900 border-red-700 text-red-100',
    success: 'bg-green-900 border-green-700 text-green-100',
    warning: 'bg-yellow-900 border-yellow-700 text-yellow-100',
    info: 'bg-blue-900 border-blue-700 text-blue-100',
  };

  const typeIcons: Record<ToastType, string> = {
    error: '❌',
    success: '✅',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return (
    <ToastContext.Provider value={{ showToast, showError, showSuccess }}>
      {children}

      {/* Toast container - fixed bottom right */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg animate-slide-in ${typeStyles[toast.type]}`}
          >
            <span className="text-lg flex-shrink-0">{typeIcons[toast.type]}</span>
            <p className="text-sm flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-current opacity-60 hover:opacity-100 flex-shrink-0"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes slide-in {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </ToastContext.Provider>
  );
}
