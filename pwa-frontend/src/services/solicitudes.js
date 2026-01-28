import { authService } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const solicitudesService = {
  // Helper para headers con token
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  // Obtener todas las solicitudes
  async getAll(filterByUser = false) {
    try {
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
    } catch (error) {
      console.error('Error obteniendo solicitudes:', error);
      throw error;
    }
  },

  // Obtener una solicitud específica
  async getById(id) {
    try {
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
    } catch (error) {
      console.error(`Error obteniendo solicitud ${id}:`, error);
      throw error;
    }
  },

  // Obtener estadísticas
  async getStats() {
    try {
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
    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      throw error;
    }
  }
};