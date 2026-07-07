'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle, Info, Bell } from 'lucide-react';

interface Toast {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({ toasts: [], addToast: () => {}, removeToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const icons = { success: <CheckCircle className="h-4 w-4 text-green-500" />, error: <AlertTriangle className="h-4 w-4 text-red-500" />, warning: <AlertTriangle className="h-4 w-4 text-amber-500" />, info: <Info className="h-4 w-4 text-blue-500" /> };

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {toasts.map(toast => (
          <div key={toast.id} className={`flex items-start gap-2 p-3 rounded-lg shadow-lg border animate-in slide-in-from-right duration-300 ${
            toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
            toast.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
            toast.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
            'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            {icons[toast.type]}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{toast.title}</p>
              <p className="text-xs opacity-80">{toast.message}</p>
            </div>
            <button onClick={() => removeToast(toast.id)} className="shrink-0"><X className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// Sound hook
export function useSound() {
  const play = useCallback((type: 'order' | 'alert' | 'notification') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'order') {
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'alert') {
        osc.frequency.value = 660;
        gain.gain.value = 0.15;
        osc.start();
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        osc.frequency.value = 520;
        gain.gain.value = 0.08;
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      }
    } catch {}
  }, []);

  return { play };
}
