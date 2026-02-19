import { authService } from './auth';
import { cachedGet } from './requestCache';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const archivosService = {
  // Helper para headers con token
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  async getBySolicitudId(solicitudId, { forceRefresh = false } = {}) {
    const cacheKey = `archivos:solicitud:${solicitudId}`;

    return cachedGet(
        cacheKey,
        async () => {
          const response = await fetch(`${API_URL}/api/archivos/solicitud/${solicitudId}`, {
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
            throw new Error(result.message || 'Error al obtener archivos');
          }

          return result.data || [];
        },
        { ttlMs: 20000, forceRefresh }
    );
  }
};