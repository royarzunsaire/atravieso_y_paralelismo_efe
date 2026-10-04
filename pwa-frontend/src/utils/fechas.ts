import { DateTime } from 'luxon';

/**
 * Helpers de fecha — conversión reloj de pared chileno ↔ UTC y formateo
 * para mostrar. Toda fecha que la PWA inserta/almacena va en UTC ISO
 * (con `Z`); acá se hace la conversión en el borde (al enviar) y el
 * formateo a hora de Chile en la capa de presentación.
 *
 * Ver `.claude/skills/pwa-inspecciones-obra/references/specs/11-fechas-utc.md`.
 */

const ZONA_CL = 'America/Santiago';

/** Error para fechas que Luxon no puede interpretar. */
export class FechaInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'FechaInvalidaError';
  }
}

/**
 * Reloj de pared chileno (`YYYY-MM-DDTHH:mm`, del input `datetime-local`)
 * → instante UTC ISO. Interpreta la zona `America/Santiago` explícita
 * (respeta el cambio de horario de esa fecha), sin depender del offset
 * del dispositivo.
 *
 * DST: si el usuario elige una hora inexistente (cambio de primavera),
 * Luxon la corre hacia adelante; si elige una hora ambigua (cambio de
 * otoño), toma el primer pase. Peor caso: 1 h en esa inspección puntual.
 * Nunca hay pérdida ni sobrescritura.
 */
export function wallChileAUTC(wall: string): string {
  const dt = DateTime.fromISO(wall, { zone: ZONA_CL });
  if (!dt.isValid) {
    throw new FechaInvalidaError(dt.invalidExplanation ?? 'Fecha inválida');
  }
  return dt.toUTC().toISO()!;
}

/**
 * Fecha calendario chilena (`YYYY-MM-DD`, del input `type=date`) →
 * instante UTC ISO anclado a las 12:00 de Chile. Mediodía ±14 h nunca
 * cruza un cambio de día, así ningún consumidor puede correr la fecha al
 * convertirla.
 */
export function fechaCierreChileAUTC(fecha: string): string {
  const dt = DateTime.fromISO(fecha, { zone: ZONA_CL }).set({
    hour: 12,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  if (!dt.isValid) {
    throw new FechaInvalidaError(dt.invalidExplanation ?? 'Fecha inválida');
  }
  return dt.toUTC().toISO()!;
}

/** Hoy en Chile como `YYYY-MM-DD` (para el `max` y el valor inicial de un input de fecha). */
export function hoyCL(): string {
  return DateTime.now().setZone(ZONA_CL).toFormat('yyyy-MM-dd');
}

/**
 * Fecha de inicio de obra elegida (`YYYY-MM-DD`) → `FechaEvento` UTC ISO.
 * Hoy → el instante actual (nunca una hora futura); un día anterior → mediodía
 * de Chile de ese día (no cruza un cambio de día en ningún huso).
 */
export function fechaInicioAEventoUTC(fecha: string): string {
  if (fecha === hoyCL()) return DateTime.now().toUTC().toISO()!;
  return fechaCierreChileAUTC(fecha);
}

/** ISO-UTC → `dd-MM-yyyy` en hora de Chile. `''` si la entrada es nula/inválida. */
export function formatearFechaCL(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = DateTime.fromISO(iso).setZone(ZONA_CL).setLocale('es-CL');
  return dt.isValid ? dt.toFormat('dd-MM-yyyy') : '';
}

/**
 * Días de calendario (hora de Chile) entre una fecha ISO-UTC y hoy.
 * Mismo día = 0. `null` si la entrada es nula/inválida. Nunca negativo.
 */
export function diasDesdeCL(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const desde = DateTime.fromISO(iso).setZone(ZONA_CL);
  if (!desde.isValid) return null;
  const hoy = DateTime.now().setZone(ZONA_CL);
  return Math.max(0, Math.floor(hoy.startOf('day').diff(desde.startOf('day'), 'days').days));
}

/** ISO-UTC → `dd-MM-yyyy HH:mm` en hora de Chile. `''` si la entrada es nula/inválida. */
export function formatearFechaHoraCL(iso: string | null | undefined): string {
  if (!iso) return '';
  const dt = DateTime.fromISO(iso).setZone(ZONA_CL).setLocale('es-CL');
  return dt.isValid ? dt.toFormat('dd-MM-yyyy HH:mm') : '';
}

/** «Ahora» en hora de Chile con el formato del input datetime-local (yyyy-MM-ddTHH:mm). */
export function ahoraCLParaInput(): string {
  return DateTime.now().setZone('America/Santiago').toFormat("yyyy-LL-dd'T'HH:mm");
}

/** ¿El reloj de pared chileno (datetime-local) es posterior a ahora? Una fecha ilegible no cuenta como futura. */
export function esFechaFutura(wall: string): boolean {
  try {
    return new Date(wallChileAUTC(wall)).getTime() > Date.now();
  } catch {
    return false;
  }
}
