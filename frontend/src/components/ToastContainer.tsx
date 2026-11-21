import React from 'react';
import { useNotificationStore } from '../store/notificationStore';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useNotificationStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-3 sm:bottom-5 inset-x-3 sm:inset-x-auto sm:right-5 z-50 flex flex-col space-y-2.5 sm:space-y-3 max-w-sm sm:max-w-md w-auto sm:w-full pointer-events-none">
      {toasts.map((toast) => {
        const getIcon = () => {
          switch (toast.type) {
            case 'SUCCESS':
              return <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />;
            case 'WARNING':
              return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />;
            case 'ERROR':
              return <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />;
            case 'INFO':
            default:
              return <Info className="w-5 h-5 text-blue-500 shrink-0" />;
          }
        };

        const getBorderColor = () => {
          switch (toast.type) {
            case 'SUCCESS':
              return 'border-l-4 border-l-emerald-500';
            case 'WARNING':
              return 'border-l-4 border-l-amber-500';
            case 'ERROR':
              return 'border-l-4 border-l-rose-500';
            default:
              return 'border-l-4 border-l-blue-500';
          }
        };

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto bg-white rounded-xl shadow-xl border border-slate-200 p-4 transition-all transform ease-out duration-300 flex items-start space-x-3 ${getBorderColor()}`}
          >
            {getIcon()}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-slate-900">{toast.title}</h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
