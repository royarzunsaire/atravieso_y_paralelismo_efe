import { authService } from './auth';
import { cachedGet } from './requestCache';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const usuariosService = {
    getHeaders() {
        const token = authService.getToken();
        return {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
        };
    },

    /**
     * Obtener lista de usuarios desde SharePoint via flow.
     * Cada item retorna { id, nombre, correo }.
     * Se cachea 5 minutos.
     */
    async getAll({ forceRefresh = false } = {}) {
        return cachedGet(
            'usuarios:all',
            async () => {
                const response = await fetch(`${API_URL}/api/usuarios`, {
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
                    throw new Error(result.message || 'Error al obtener usuarios');
                }

                return result.data || [];
            },
            { ttlMs: 5 * 60 * 1000, forceRefresh }
        );
    },
};
