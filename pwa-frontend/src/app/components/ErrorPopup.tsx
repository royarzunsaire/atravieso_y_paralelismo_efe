import { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { ErrorParaUsuario } from '@/utils/mensajesError';

interface ErrorPopupProps {
  error: ErrorParaUsuario;
  onCerrar: () => void;
  /** Si se indica, aparece el botón «Reintentar». */
  onReintentar?: () => void;
  /** Botón extra (ej. «Continuar con los datos guardados») cuando seguir sin esta operación tiene sentido. */
  textoAlternativa?: string;
  onAlternativa?: () => void;
}

/**
 * Popup que explica POR QUÉ falló una operación (contrato CU-22): título claro, qué hacer y,
 * si hay, el detalle técnico desplegable. Botones grandes (≥ 48 px) para usuarios mayores.
 */
export function ErrorPopup({ error, onCerrar, onReintentar, textoAlternativa, onAlternativa }: ErrorPopupProps) {
  const [verDetalle, setVerDetalle] = useState(false);

  return (
    <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="error-popup-titulo"
        aria-describedby="error-popup-mensaje"
        className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-5"
      >
        <div className="flex items-start gap-3 mb-3">
          <AlertTriangle className="w-7 h-7 text-[#E30613] flex-shrink-0" />
          <h2 id="error-popup-titulo" className="text-lg font-semibold text-[#1A1A1A] leading-snug">
            {error.titulo}
          </h2>
        </div>

        <p id="error-popup-mensaje" className="text-base text-[#1A1A1A] mb-4 whitespace-pre-wrap break-words">
          {error.mensaje}
        </p>

        {error.detalle && (
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setVerDetalle((v) => !v)}
              className="flex items-center gap-1 text-sm text-[#0066CC] min-h-12"
              aria-expanded={verDetalle}
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${verDetalle ? 'rotate-180' : ''}`} />
              {verDetalle ? 'Ocultar detalle técnico' : 'Ver detalle técnico'}
            </button>
            {verDetalle && (
              <p className="mt-1 text-sm text-[#4A4A4A] bg-[#F5F7FA] rounded-lg p-3 break-words">{error.detalle}</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {onReintentar && (
            <button
              type="button"
              onClick={onReintentar}
              className="w-full min-h-12 rounded-lg bg-[#0066CC] text-white text-base font-semibold active:bg-[#003D7A]"
            >
              Reintentar
            </button>
          )}
          {onAlternativa && textoAlternativa && (
            <button
              type="button"
              onClick={onAlternativa}
              className="w-full min-h-12 rounded-lg border-2 border-[#0066CC] text-[#0066CC] text-base font-semibold active:bg-blue-50"
            >
              {textoAlternativa}
            </button>
          )}
          <button
            type="button"
            onClick={onCerrar}
            className="w-full min-h-12 rounded-lg border-2 border-[#003D7A]/30 text-[#003D7A] text-base font-semibold active:bg-[#F5F7FA]"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
