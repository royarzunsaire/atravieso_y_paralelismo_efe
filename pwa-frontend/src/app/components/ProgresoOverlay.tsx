import { Loader2 } from 'lucide-react';

interface ProgresoOverlayProps {
  /** Mensaje de la etapa actual (cambia mientras avanza la operación). */
  mensaje: string;
  /** true cuando la espera ya pasó el umbral: se avisa que la plataforma está lenta. */
  lento: boolean;
}

/**
 * Indicador de espera de PANTALLA COMPLETA (contrato CU-22): bloquea la interacción mientras
 * una operación está en curso, para no duplicar envíos. El botón que la inició conserva su texto.
 */
export function ProgresoOverlay({ mensaje, lento }: ProgresoOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-6"
      role="alert"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-white rounded-2xl shadow-xl px-6 py-7 w-full max-w-xs text-center">
        <Loader2 className="w-12 h-12 text-[#0066CC] animate-spin mx-auto mb-4" />
        <p className="text-lg font-semibold text-[#003D7A] break-words">{mensaje}</p>
        {lento && (
          <p className="mt-3 text-base text-[#4A4A4A]">
            La plataforma está tardando más de lo normal. No cierres la aplicación: seguimos esperando.
          </p>
        )}
      </div>
    </div>
  );
}
