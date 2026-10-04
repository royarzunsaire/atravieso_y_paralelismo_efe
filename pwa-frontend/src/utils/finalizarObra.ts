// Requisito para «Finalizar obra» (contrato CU-24): el avance de la obra debe estar en 100 %
// Y debe existir al menos una inspección registrada con 100 %. Misma regla en el backend
// (pwa-backend/routes/eventos.js); acá solo se explica el motivo para el usuario.

export const ACCION_FINALIZAR_OBRA = 'OBRA_FINALIZADA';

/** Texto del motivo por el que NO se puede finalizar, o null si se puede. */
export function motivoNoPuedeFinalizar(
  avanceObra: number,
  avancesInspecciones: number[],
  cargandoInspecciones: boolean,
): string | null {
  if (Math.round(avanceObra || 0) < 100) {
    return `El avance de la obra debe estar en 100 % (hoy está en ${Math.round(avanceObra || 0)} %).`;
  }
  if (cargandoInspecciones) return 'Cargando inspecciones…';
  if (!avancesInspecciones.some((a) => Math.round(a || 0) >= 100)) {
    return 'Falta al menos una inspección registrada con 100 % de avance.';
  }
  return null;
}
