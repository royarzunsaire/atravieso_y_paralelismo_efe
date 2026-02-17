import { authService } from './auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const inspeccionesService = {
  // Helper para headers con token
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      'X-App-Version': '1.0.0'
    };
  },

  // Crear una nueva inspección
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

      return result.data;
    } catch (error) {
      console.error('Error creando inspección:', error);
      throw error;
    }
  }
};