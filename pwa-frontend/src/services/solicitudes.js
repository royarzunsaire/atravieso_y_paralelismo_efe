import { authService } from './auth';
import { cachedGet } from './requestCache';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const solicitudesService = {
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  async getAll(filterByUser = false, { forceRefresh = false } = {}) {
    const cacheKey = `solicitudes:list:${filterByUser ? 'mine' : 'all'}`;

    return cachedGet(
        cacheKey,
        async () => {
          const url = filterByUser
              ? `${API_URL}/api/solicitudes?filterByUser=true`
              : `${API_URL}/api/solicitudes`;

          const response = await fetch(url, {
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
          return result.data || [];
        },
        { ttlMs: 20000, forceRefresh }
    );
  },

  async getById(id, { forceRefresh = false } = {}) {
    const cacheKey = `solicitudes:detail:${id}`;

    return cachedGet(
        cacheKey,
        async () => {
          const response = await fetch(`${API_URL}/api/solicitudes/${id}`, {
            method: 'GET',
            headers: this.getHeaders()
          });

          if (response.status === 401) {
            authService.logout();
            throw new Error('Sesión expirada');
          }

          if (response.status === 404) {
            throw new Error('Solicitud no encontrada');
          }

          if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
          }

          const result = await response.json();
          return result.data;
        },
        { ttlMs: 30000, forceRefresh }
    );
  },

  async getStats({ forceRefresh = false } = {}) {
    return cachedGet(
        'solicitudes:stats',
        async () => {
          const response = await fetch(`${API_URL}/api/solicitudes/stats/summary`, {
            method: 'GET',
            headers: this.getHeaders()
          });

          if (response.status === 401) {
            authService.logout();
            throw new Error('Sesión expirada');
          }

          if (!response.ok) {
            throw new Error(`Error del servidor: ${response.status}`);
          }

          const result = await response.json();
          return result.data;
        },
        { ttlMs: 20000, forceRefresh }
    );
  }
};