import { reiniciarCachesDeSesion } from './sesionCache';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const authService = {
  // Login local
  async loginLocal(email, password) {
    const response = await fetch(`${API_URL}/auth/login/local`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      // 429 (demasiados intentos) trae su explicación en `message`; el resto de errores, en `error`.
      throw new Error(data.message || data.error || 'Error al iniciar sesión');
    }

    // Guardar token y usuario en localStorage
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
  },

  // Cambiar contraseña propia
  async changePassword(currentPassword, newPassword) {
    const token = this.getToken();

    const response = await fetch(`${API_URL}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Error al cambiar la contraseña');
    }

    // Limpiar el flag localmente para no depender de un refetch de /me
    const user = this.getUser();
    if (user) {
      localStorage.setItem('user', JSON.stringify({ ...user, debeCambiarPassword: false }));
    }

    return data;
  },

  // Obtener usuario actual
  async getCurrentUser() {
    const token = this.getToken();
    if (!token) return null;

    const response = await fetch(`${API_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      this.logout();
      return null;
    }

    const data = await response.json();
    return data.user;
  },

  // Logout
async logout() {
  try {
    const token = this.getToken();

    if (token) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    }
  } catch (e) {
    console.warn('⚠️  Error cerrando sesión en servidor:', e.message);
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Claves de una versión antigua (Supabase): ya no se escriben, pero se borran por si algún dispositivo las conserva (H-23).
    localStorage.removeItem('connection_token');
    localStorage.removeItem('supabase_session');
    // H-14: borradores de inspección (con fotos), obra abierta y demás datos de la pestaña no deben sobrevivir al cierre de sesión.
    try { sessionStorage.clear(); } catch { /* sin acceso al almacenamiento: nada que limpiar */ }
    // CU-20: lo guardado en memoria de esta sesión (obras, detalles, fotos, catálogo) se descarta.
    reiniciarCachesDeSesion();
  }
},

  // Obtener token
  getToken() {
    return localStorage.getItem('token');
  },

  // Obtener usuario guardado
  getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // Verificar si está autenticado
  isAuthenticated() {
    return !!this.getToken();
  }
};