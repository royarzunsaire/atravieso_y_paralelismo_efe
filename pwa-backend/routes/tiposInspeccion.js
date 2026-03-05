import { authService } from './auth';
import { cachedGet } from './requestCache';
import type { TipoInspeccion } from '@/context/CatalogsContext';

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
     * Caché de 5 min — usada por CatalogsContext, no llamar directamente desde componentes.
     */
    async getAll({ forceRefresh = false } = {}): Promise<TipoInspeccion[]> {
        return cachedGet(
            'tipos-inspeccion:all',
            async () => {
                const response = await fetch(`${API_URL}/api/tipos-inspeccion`, {
                    method: 'GET',
                    headers: this.getHeaders(),
                });
                if (response.status === 401) {
                    authService.logout();
                    throw new Error('Sesión expirada');
                }
                if (!response.ok) throw new Error(`Error del servidor: ${response.status}`);
                const result = await response.json();
                if (!result.success) throw new Error(result.message || 'Error al obtener tipos');
                return result.data || [];
            },
            { ttlMs: 5 * 60 * 1000, forceRefresh }
        );
    },
};