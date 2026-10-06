// Avance con el que se envía cualquier acción que no trae uno propio (contrato CU-13).
// Cada evento crea una inspección en la API y, sin `AvancePct`, queda en 0 %: por eso toda acción lleva
// el avance vigente de la obra.
import { detalleCache } from '@/services/detalleCache';
import type { ObraInicio } from '@/types/eventos';

/**
 * Avance vigente de la obra, en %:
 *  1) el de la OBRA (el mismo del dashboard y Ctrl. Obra) si es mayor a 0;
 *  2) si viniera en 0 (la API a veces lo deja así), el de la inspección MÁS RECIENTE con avance mayor a 0
 *     del detalle ya cargado (nunca la «última» a secas: puede ser una detención/reactivación con 0 %);
 *  3) 0 si la obra de verdad no ha avanzado.
 */
export function avanceVigente(obra: ObraInicio | null | undefined): number {
  if (!obra) return 0;
  const deObra = Math.round(Number(obra.AvanceObraPct) || 0);
  if (deObra > 0) return deObra;

  const inspecciones = (detalleCache.get(obra.Id)?.data?.Inspecciones ?? []) as { Fecha?: string; PorcentajeAvance?: number }[];
  const ultimaConAvance = inspecciones
    .filter((i) => Number(i.PorcentajeAvance) > 0)
    .sort((a, b) => new Date(b.Fecha ?? 0).getTime() - new Date(a.Fecha ?? 0).getTime())[0];
  return Math.round(Number(ultimaConAvance?.PorcentajeAvance) || 0);
}
