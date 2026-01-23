import { storage } from './storage';
import { authService } from './auth'; 

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';


export const syncService = {
  isOnline() {
    return navigator.onLine;
  },

  // NUEVO: Helper para headers con token
  getHeaders() {
    const token = authService.getToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  async fetchServerData() {
    if (!this.isOnline()) {
      throw new Error('No hay conexión a internet');
    }

    try {
      const response = await fetch(`${API_URL}/datos`, {
        method: 'GET',
        headers: this.getHeaders() // ← Usar headers con token
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
      console.error('Error obteniendo datos del servidor:', error);
      throw error;
    }
  },

  async syncPendingData() {
    if (!this.isOnline()) {
      throw new Error('No hay conexión a internet');
    }

    const pendingData = await storage.getPendingData();
    const unsynced = pendingData.filter(item => !item.synced);

    if (unsynced.length === 0) {
      return { success: true, synced: 0 };
    }

    const results = [];
    const errors = [];
    
    for (const item of unsynced) {
      try {
        const response = await fetch(`${API_URL}/datos`, {
          method: 'POST',
          headers: this.getHeaders(), // ← Usar headers con token
          body: JSON.stringify(item)
        });

        if (response.status === 401) {
          authService.logout();
          throw new Error('Sesión expirada');
        }

        if (response.ok) {
          results.push(item.id);
        } else {
          errors.push(item.id);
        }
      } catch (error) {
        console.error('Error sincronizando item:', error);
        errors.push(item.id);
      }
    }

    if (results.length > 0) {
      await storage.markAsSynced(results);
    }

    return {
      success: true,
      synced: results.length,
      failed: errors.length
    };
  }
};