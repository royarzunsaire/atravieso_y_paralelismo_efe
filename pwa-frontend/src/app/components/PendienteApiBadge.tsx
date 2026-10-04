import { API_SOPORTA, type CampoApi } from '@/utils/apiSupport';

/**
 * Cartel "Pendiente en la API". Se dibuja solo si la API todavía no
 * soporta el campo (ver utils/apiSupport.ts); si lo soporta, no renderiza.
 */
export function PendienteApiBadge({ campo }: { campo: CampoApi }) {
  if (API_SOPORTA[campo]) return null;
  return (
    <div className="mb-2 inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-300 rounded text-[10px] font-semibold text-amber-700">
      ⚠ Pendiente en la API — no se envía aún
    </div>
  );
}
