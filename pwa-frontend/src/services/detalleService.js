import { authService } from './auth';
import { detalleCache } from './detalleCache';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// Pedidos en curso: si dos partes piden lo mismo a la vez (dashboard y detalle,
// cola de inspecciones y motivo de la detención, doble render de StrictMode),
// comparten UNA sola petición. La API atiende de a una y cada repetida se
// encolaba detrás (3,8 → 7,6 → 11,5 s).
const detalleEnVuelo = new Map();
const inspeccionEnVuelo = new Map();

function compartir(mapa, clave, crear) {
  const existente = mapa.get(clave);
  if (existente) return existente;
  const promesa = crear().finally(() => {
    if (mapa.get(clave) === promesa) mapa.delete(clave);
  });
  mapa.set(clave, promesa);
  return promesa;
}

export const detalleService = {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  },

  /**
   * Detalle de una obra vía API_Detalle (Etapa B, spec 13): inspecciones
   * con sus fotos/informes ya adentro, documentos, y acciones habilitadas.
   * Las URLs de archivos son directas a SharePoint y expiran ~1h — no se
   * cachean más allá de esta llamada.
   */
  /**
   * `fresco: true` = no reutilizar un pedido ya en curso (lo usa el refresco
   * posterior a un evento: un pedido iniciado ANTES del evento traería datos viejos).
   */
  async getDetalle(solicitudId, { fresco = false } = {}) {
    if (fresco) return this._pedirDetalle(solicitudId);
    return compartir(detalleEnVuelo, solicitudId, () => this._pedirDetalle(solicitudId));
  },

  async _pedirDetalle(solicitudId) {
    const response = await fetch(`${API_URL}/api/v2/solicitudes/${solicitudId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      authService.logout();
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }

    const data = await response.json().catch(() => ({}));

    // 403: el usuario no es ITO ni Supervisor de esta obra. Reintentar no cambia nada: se marca para no ofrecerlo.
    if (response.status === 403) {
      const err = new Error(data?.message || 'No tienes acceso a esta solicitud.');
      err.code = 'SIN_ACCESO';
      throw err;
    }

    if (response.status === 404) {
      const err = new Error('La solicitud no fue encontrada.');
      err.code = 'SOLICITUD_NO_ENCONTRADA';
      throw err;
    }

    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || data?.error || `Error del servidor: ${response.status}`);
    }

    return data;
  },

  /**
   * Detalle completo de UNA inspección (comentario, lat/lng, paralización,
   * fotos y documentos). El detalle de obra solo trae un resumen. Se cachea
   * en memoria por sesión de pantalla (las URLs de archivos expiran ~1h).
   */
  async getInspeccion(inspeccionId, { forzar = false } = {}) {
    if (forzar) return this._pedirInspeccion(inspeccionId);
    const cacheada = detalleCache.getInspeccion(inspeccionId);
    if (cacheada) return cacheada.data;
    return compartir(inspeccionEnVuelo, inspeccionId, () => this._pedirInspeccion(inspeccionId));
  },

  async _pedirInspeccion(inspeccionId) {
    const response = await fetch(`${API_URL}/api/v2/inspecciones/${inspeccionId}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      authService.logout();
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || data?.error || `Error del servidor: ${response.status}`);
    }

    detalleCache.setInspeccion(inspeccionId, data);
    return data;
  },

  /**
   * "Calienta" el cache con el detalle de una obra, en segundo plano —
   * pensado para el dashboard (obras más recientes). Silencioso: si falla
   * (incluida sesión expirada, que getDetalle ya maneja con logout), no
   * interrumpe al usuario con ningún mensaje — el error ya se manifestará
   * cuando interactúe con la app normalmente.
   */
  async prefetchDetalle(solicitudId) {
    // No reintentar en cada remount/navegación — una vez por sesión basta
    // (éxito o error; si falló, el detalle se carga normal al entrar).
    if (detalleCache.yaIntentado(solicitudId)) return;
    detalleCache.marcarIntentado(solicitudId);
    try {
      const data = await this.getDetalle(solicitudId);
      detalleCache.set(solicitudId, data);
    } catch {
      // Precarga fallida — el detalle se cargará normal cuando el usuario entre.
    }
  },
};
