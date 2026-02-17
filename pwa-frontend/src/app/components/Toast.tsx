import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertOctagon, X } from 'lucide-react';

interface ToastProps {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning';
  title: string;
  message?: string;
  onClose: () => void;
  autoClose?: number; // ms, 0 = no autoclose
}

export function Toast({ isOpen, type, title, message, onClose, autoClose = 3500 }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Pequeño delay para activar la animación de entrada
      const t = setTimeout(() => setVisible(true), 10);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && autoClose > 0) {
      const t = setTimeout(onClose, autoClose);
      return () => clearTimeout(t);
    }
  }, [isOpen, autoClose, onClose]);

  if (!isOpen) return null;

  const config = {
    success: {
      bg: 'bg-white',
      border: 'border-l-4 border-l-green-500',
      iconBg: 'bg-green-100',
      icon: <CheckCircle2 className="w-6 h-6 text-green-600" />,
      titleColor: 'text-[#1A1A1A]',
      bar: 'bg-green-500',
    },
    error: {
      bg: 'bg-white',
      border: 'border-l-4 border-l-[#E30613]',
      iconBg: 'bg-red-100',
      icon: <XCircle className="w-6 h-6 text-[#E30613]" />,
      titleColor: 'text-[#1A1A1A]',
      bar: 'bg-[#E30613]',
    },
    warning: {
      bg: 'bg-white',
      border: 'border-l-4 border-l-orange-500',
      iconBg: 'bg-orange-100',
      icon: <AlertOctagon className="w-6 h-6 text-orange-500" />,
      titleColor: 'text-[#1A1A1A]',
      bar: 'bg-orange-500',
    },
  }[type];

  return (
    // Overlay para centrar en pantalla
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8 pointer-events-none sm:items-end">
      <div
        className={`
          w-full max-w-sm pointer-events-auto
          ${config.bg} ${config.border}
          rounded-xl shadow-2xl overflow-hidden
          transition-all duration-300 ease-out
          ${visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}
        `}
      >
        {/* Barra de progreso superior si hay autoclose */}
        {autoClose > 0 && (
          <div className="h-1 w-full bg-gray-100">
            <div
              className={`h-full ${config.bar} origin-left`}
              style={{
                animation: isOpen ? `shrink ${autoClose}ms linear forwards` : 'none',
              }}
            />
          </div>
        )}

        <div className="flex items-start gap-3 p-4">
          {/* Icono */}
          <div className={`flex-shrink-0 w-10 h-10 ${config.iconBg} rounded-full flex items-center justify-center`}>
            {config.icon}
          </div>

          {/* Texto */}
          <div className="flex-1 min-w-0 pt-0.5">
            <p className={`font-medium text-base ${config.titleColor}`}>{title}</p>
            {message && (
              <p className="text-sm text-[#4A4A4A] mt-1 leading-relaxed">{message}</p>
            )}
          </div>

          {/* Botón cerrar */}
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-[#4A4A4A] transition-colors active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Animación CSS inline para la barra de progreso */}
      <style>{`
        @keyframes shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
}