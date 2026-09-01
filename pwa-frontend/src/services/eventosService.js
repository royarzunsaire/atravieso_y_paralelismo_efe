import { authService } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Genera un EventoIdExterno único. Se crea UNA vez, en el momento en que
 * el usuario aprieta el botón, y se reusa en todos los reintentos — la API
 * deduplica por él. Generar uno nuevo al reintentar registraría el evento
 * dos veces (el error clásico), por eso el llamador debe persistirlo.
 */
export function generarEventoIdExterno() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback muy conservador (navegadores viejos sin crypto.randomUUID).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normaliza AccionesHabilitadas: la API_Inicio las devuelve como códigos
 * (strings), la API_Evento_Obra como objetos completos. El resto de la app
 * trabaja siempre con códigos, sin importar de qué servicio vinieron.
 */
export function normalizarAcciones(acciones) {
  if (!Array.isArray(acciones)) return [];
  return acciones.map((a) => (typeof a === 'string' ? a : a?.Codigo)).filter(Boolean);
}

export const eventosService = {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  },

  /**
   * Registra un evento sobre una obra (escritura). Sigue el patrón outbox:
   * el backend guarda en Oracle y responde. Con sync=true el backend además
   * sincroniza inline contra la API real y devuelve el estado nuevo de la
   * obra (SubEstado, AccionesHabilitadas) para refrescar la pantalla.
   *
   * @param {Object} p
   * @param {number} p.solicitudId
   * @param {string} p.tipoEvento         código de la acción (del catálogo)
   * @param {string} p.eventoIdExterno    UUID — generarlo ANTES con
   *                                       generarEventoIdExterno() y reusarlo
   *                                       en reintentos
   * @param {Object} [p.payload]          Comentario, AvancePct, Fotos, etc.
   * @param {boolean} [p.sync=true]       sincronizar inline (flujo interactivo)
   * @param {string} [p.fechaEvento]      ISO real del hecho (para eventos
   *                                       encolados sin señal)
   * @returns {Promise<{ ok, estadoSync, oracleId, accionNoPermitida, data, mensaje }>}
   */
  async registrarEvento({ solicitudId, tipoEvento, eventoIdExterno, payload = {}, sync = true, fechaEvento }) {
    const response = await fetch(`${API_URL}/api/v2/eventos`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        solicitudId,
        tipoEvento,
        eventoIdExterno,
        payload,
        sync,
        fechaEvento,
      }),
    });

    if (response.status === 401) {
      authService.logout();
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }

    const data = await response.json().catch(() => ({}));

    // 201 (guardado, no sincronizado inline) o 200 (sincronizado) → éxito
    // desde el punto de vista del usuario: el evento está a salvo en Oracle.
    if (response.ok) {
      const d = data.data || {};
      return {
        ok: true,
        estadoSync: d.estadoSync || 'pendiente',
        oracleId: d.id,
        data: d,
        acciones: normalizarAcciones(d.AccionesHabilitadas),
        subEstado: d.SubEstado,
        avanceObraPct: d.AvanceObraPct,
        mensaje: data.message || 'Evento registrado.',
      };
    }

    // 202: guardado en Oracle pero no sincronizó ahora (queda en la cola).
    if (response.status === 202) {
      return {
        ok: true,
        estadoSync: 'pendiente',
        oracleId: data.data?.id,
        accionNoPermitida: data.accionNoPermitida === true,
        data: data.data || {},
        mensaje: data.message || 'Guardado, se sincronizará luego.',
      };
    }

    // Otros errores.
    return {
      ok: false,
      accionNoPermitida: data.accionNoPermitida === true,
      data,
      mensaje: data.message || data.error || `Error del servidor: ${response.status}`,
    };
  },
};
