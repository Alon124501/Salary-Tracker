import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'error') => {
    const safeMessage = typeof message === 'string' ? message : (message?.message || 'An error occurred');
    const id = Date.now();
    setToasts(prev => [...prev, { id, message: safeMessage, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="fixed bottom-24 left-0 right-0 flex flex-col items-center gap-2 z-50 pointer-events-none px-4">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto max-w-sm w-full px-4 py-3 rounded-2xl text-sm font-semibold shadow-lg flex items-center gap-2 animate-fade-in ${
              t.type === 'error'
                ? 'bg-red-500 text-white'
                : t.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 text-white'
            }`}
          >
            <span className="material-symbols-outlined text-base flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
              {t.type === 'error' ? 'error' : t.type === 'success' ? 'check_circle' : 'info'}
            </span>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
