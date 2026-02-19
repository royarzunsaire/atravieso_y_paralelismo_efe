import { authService } from './auth';
import { cachedGet, invalidateCache } from './requestCache';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const inspeccionesService = {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-App-Version': '1.0.0'
    };
  },

      async getBySolicitudId(solicitudId, { forceRefresh = false } = {}) {
        const cacheKey = `inspecciones:solicitud:${solicitudId}`;

        return cachedGet(
            cacheKey,
            async () => {
              const response = await fetch(`${API_URL}/api/inspecciones/solicitud/${solicitudId}`, {
                method: 'GET',
                headers: this.getHeaders()
              });



              if (response.status === 401) {
                authService.logout();
                throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
              }

              if (!response.ok) {
                throw new Error(`Error del servidor: ${response.status}`);
              }
              const result = await response.json();

              if (!result.success) {
                throw new Error(result.message || 'Error al obtener inspecciones');
              }

              return result.data || [];
            },
            { ttlMs: 10000, forceRefresh }
        );
      },

  async create(inspeccionData) {
    try {
      const response = await fetch(`${API_URL}/api/inspecciones`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(inspeccionData)
      });

      if (response.status === 401) {
        authService.logout();
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Error del servidor: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.message || 'Error al crear inspección');
      }

      invalidateCache('inspecciones:solicitud:');
      return result.data;
    } catch (error) {
      console.error('Error creando inspección:', error);
      throw error;
    }
  }
};