/**
 * tiposInspeccion.js
 * pwa-frontend/src/services/tiposInspeccion.js  ← ARCHIVO NUEVO
 *
 * Servicio JavaScript puro, igual que archivos.js, inspecciones.js, etc.
 * Las interfaces/tipos están en CatalogsContext.tsx.
 *
 * IMPORTANTE: Solo debe ser usado por CatalogsContext, nunca por componentes.
 */

import { authService } from './auth';
import { cachedGet } from './requestCache';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const tiposInspeccionService = {
    getHeaders() {
        const token = authService.getToken();
        return {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
        };
    },

    /**
     * Obtener todos los tipos de inspección.
     * Caché de 5 min en cliente + caché de 5 min en servidor = doble capa.
     * Solo llamar desde CatalogsContext.
     */
    async getAll({ forceRefresh = false } = {}) {
        return cachedGet(
            'tipos-inspeccion:all',
            async () => {
                const response = await fetch(`${API_URL}/api/tipos-inspeccion`, {
                    method: 'GET',
                    headers: this.getHeaders(),
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
                    throw new Error(result.message || 'Error al obtener tipos de inspección');
                }

                return result.data || [];
            },
            { ttlMs: 5 * 60 * 1000, forceRefresh }
        );
    },
};