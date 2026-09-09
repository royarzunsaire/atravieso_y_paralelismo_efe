const { DateTime } = require('luxon');

/**
 * Helpers de fecha del backend. El backend Express SIEMPRE trabaja en UTC:
 * valida/normaliza las fechas de negocio que manda el cliente y nunca
 * emite hora local. Ver
 * `.claude/skills/pwa-inspecciones-obra/references/specs/11-fechas-utc.md`.
 */

class FechaInvalidaError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = 'FechaInvalidaError';
  }
}

// ISO 8601 que termina en `Z` o en un offset (`+03:00` / `-0400`).
const CON_ZONA = /([zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * Valida una fecha de negocio que manda el cliente y la normaliza a UTC
 * ISO. Acepta cualquier ISO 8601 con offset o `Z`. Si no trae zona
 * (reloj de pared pelado) o no parsea → lanza FechaInvalidaError, y la
 * ruta responde 400 (no se sustituye en silencio).
 *
 * @param {string} value
 * @param {string} [campo='fechaInspeccion'] nombre del campo para los mensajes de error
 * @returns {string} ISO 8601 en UTC (`...Z`)
 */
function parseFechaInspeccion(value, campo = 'fechaInspeccion') {
  if (typeof value !== 'string' || !value.trim()) {
    throw new FechaInvalidaError(`${campo} es obligatoria`);
  }
  const limpio = value.trim();
  if (!CON_ZONA.test(limpio)) {
    throw new FechaInvalidaError(`${campo} debe incluir zona horaria (Z u offset)`);
  }
  const dt = DateTime.fromISO(limpio, { setZone: true });
  if (!dt.isValid) {
    throw new FechaInvalidaError(dt.invalidExplanation || `${campo} no es una fecha ISO válida`);
  }
  return dt.toUTC().toISO();
}

/**
 * Igual que parseFechaInspeccion pero opcional: devuelve null si no viene.
 * Se usa para `fechaEvento` (v2): si el cliente la manda desde la cola
 * offline se valida; si no, la ruta pone `now()` UTC (intencional).
 *
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function parseFechaEventoOpcional(value) {
  if (value == null || value === '') return null;
  return parseFechaInspeccion(value, 'fechaEvento');
}

module.exports = { FechaInvalidaError, parseFechaInspeccion, parseFechaEventoOpcional };
