import { authService } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// El catálogo y su versión se guardan JUNTOS (contrato del MD): nunca uno
// sin el otro. Si el almacenamiento está vacío/corrupto, se manda '' y el
// servidor responde con el catálogo completo — no hay estado inválido.
const LS_CATALOGO = 'ayp.catalogo';
const LS_CATALOGO_VERSION = 'ayp.catalogoVersion';

function leerCatalogoCacheado() {
  try {
    const raw = localStorage.getItem(LS_CATALOGO);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function leerVersionCacheada() {
  try {
    return localStorage.getItem(LS_CATALOGO_VERSION) || '';
  } catch {
    return '';
  }
}

function guardarCatalogo(catalogo, version) {
  try {
    localStorage.setItem(LS_CATALOGO, JSON.stringify(catalogo));
    localStorage.setItem(LS_CATALOGO_VERSION, version || '');
  } catch {
    // Si falla el guardado, no rompemos — el próximo arranque manda '' y
    // el servidor devuelve todo de nuevo.
  }
}

export const inicioService = {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    };
  },

  /**
   * Carga inicial: obras del usuario ya filtradas + catálogo + acciones.
   * Maneja el mecanismo de CatalogosVersion: manda la versión cacheada; si
   * el servidor responde Catalogos:null, usa el cacheado.
   *
   * @param {{ forzarCatalogo?: boolean }} opts  forzarCatalogo manda '' a
   *        propósito para traer el catálogo completo (gesto de recarga).
   * @returns {Promise<{ usuario, obras, catalogo, catalogosVersion, total }>}
   */
  async getInicio({ forzarCatalogo = false } = {}) {
    const version = forzarCatalogo ? '' : leerVersionCacheada();

    const url = new URL(`${API_URL}/api/v2/inicio`);
    if (version) url.searchParams.set('catalogosVersion', version);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (response.status === 401) {
      authService.logout();
      throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
    }

    const data = await response.json().catch(() => ({}));

    if (response.status === 404 || data?.error === 'USUARIO_NO_ENCONTRADO') {
      const err = new Error('Tu usuario no está registrado en el sistema de obras.');
      err.code = 'USUARIO_NO_ENCONTRADO';
      throw err;
    }

    if (!response.ok || data?.success === false) {
      throw new Error(data?.message || data?.error || `Error del servidor: ${response.status}`);
    }

    // Catálogo: si viene null, usar el cacheado; si viene con datos, reemplazar.
    let catalogo;
    if (data.Catalogos == null) {
      catalogo = leerCatalogoCacheado();
    } else {
      catalogo = data.Catalogos;
      guardarCatalogo(data.Catalogos, data.CatalogosVersion);
    }

    return {
      usuario: data.Usuario || null,
      obras: Array.isArray(data.Solicitudes) ? data.Solicitudes : [],
      total: data.TotalSolicitudes ?? 0,
      catalogo,
      catalogosVersion: data.CatalogosVersion || version,
    };
  },

  /** El catálogo guardado, para resolver códigos de acción sin re-fetch. */
  getCatalogoCacheado() {
    return leerCatalogoCacheado();
  },

  /**
   * Resuelve un código de acción contra el catálogo cacheado.
   * Devuelve el objeto de la acción (Label, Icono, banderas Requiere*,
   * TiposDocumento) o null si el código no está en el catálogo — en cuyo
   * caso el llamador debe omitir ese botón, no romper la pantalla.
   */
  resolverAccion(codigo, catalogo = null) {
    const cat = catalogo || leerCatalogoCacheado();
    const tipos = cat?.TiposEvento;
    if (!Array.isArray(tipos)) return null;
    return tipos.find((t) => t.Codigo === codigo) || null;
  },
};
